+++
title = "Handling failure in Rust"
+++

I've begun to seriously dig into the [Rust programming language](https://www.rust-lang.org/). The learning curve is real, but I already appreciate the work they've put into ergonomics.

I'm writing a simple photo thumbnail endpoint using the [Rocket web framework](https://rocket.rs/) ([v0.4](https://rocket.rs/v0.4/guide/)) and [Image library](https://github.com/PistonDevelopers/image) ([v0.20.1](https://docs.rs/crate/image/0.20.1)). My first pass used a lot of unwrapping to ignore potential errors. A lot can go wrong, even in this "simple" case.

<!-- more -->

> **Note**: This post assumes some [minimal familiarity with Rust](https://doc.rust-lang.org/). I've omitted `extern`, `use` and other pesky logistics for the sake of brevity.

```rust
#[get("/thumbnail/<photo_name>")]
fn thumbnail(photo_name: String) -> Content<Vec<u8>> {
    let full_path = Path::new(PHOTO_PATH).join(&photo_name);

    // This will fail if the string is not valid unicode
    let full_path_str = full_path.to_str().unwrap();

    // This could fail for any number of filesystem/IO/memory reasons
    let img = image::open(&full_path_str).unwrap();

    let thumb = img.thumbnail(500, 500);
    let mut buffer = Vec::new();
    thumb
        .write_to(&mut buffer, image::ImageOutputFormat::JPEG(80))
        // This could fail for various obscure reasons
        // internal to the `image` library.
        .expect("Failed to write!");

    Content(ContentType::JPG, buffer)
}
```

Rocket catches any panics thrown by route handlers, so this is about as robust as a naive equivalent in most other languages. However, Rust at least forces us to be explicit and purposeful about when we want to be sloppy. This is great for a first quick and dirty pass, but we can do much better.

## Option

The simplest way to avoid unwrapping is to convert each failure value into an `Option`.

```rust
#[get("/thumbnail/<photo_name>")]
fn thumbnail(photo_name: String) -> Option<Content<Vec<u8>>> {
    let full_path = Path::new(PHOTO_PATH).join(&photo_name);

    // This is already an Option<&str>
    let full_path_str = full_path.to_str()?;

    // Throw away the Err if we fail to open the image
    let img = image::open(&full_path_str).ok()?;

    let thumb = img.thumbnail(500, 500);
    let mut buffer = Vec::new();
    thumb
        .write_to(&mut buffer, image::ImageOutputFormat::JPEG(80))
        .ok()?; // We don't really know why this failed

    Some(Content(ContentType::JPG, buffer))
}
```

When you put `?` after an `Option` or `Result` Rust will short circuit the function if that value is `None` or `Err`. This can be much nicer than `if value.is_err()` checks, [match expressions](https://doc.rust-lang.org/reference/expressions/match-expr.html) or try/catch blocks.

The substantive downside to this approach is that we have no way to add more detail. Rocket turns `None` in a 404 response. While it feels better than a 500, this is still not ideal or correct.

## Result

We want to return different error status codes depending on what went wrong. This is the direct approach.

```rust
#[get("/thumbnail/<photo_name>")]
fn thumbnail(photo_name: String) -> Result<Content<Vec<u8>>, Status> {
    let full_path = Path::new(PHOTO_PATH).join(&photo_name);

    // Even this isn't technically correct as PHOTO_PATH could be the
    // source of the invalid unicode
    let full_path_str = full_path.to_str().ok_or(Status::BadRequest)?;

    // Extract mildly involved Err conversion into a function
    let img = image::open(&full_path_str).map_err(img_err_to_status)?;

    let thumb = img.thumbnail(500, 500);
    let mut buffer = Vec::new();
    thumb
        .write_to(&mut buffer, image::ImageOutputFormat::JPEG(80))
        // Once again, we don't really know why this failed
        .or(Err(Status::InternalServerError))?;

    Ok(Content(ContentType::JPG, buffer))
}

fn img_err_to_status(img_err: image::ImageError) -> rocket::http::Status {
    match img_err {
        ImageError::IoError(io_err) => match io_err.kind() {
            NotFound => Status::NotFound,
            PermissionDenied => Status::Forbidden,
            // The std::io::ErrorKind enum is non-exhaustive, meaning they
            // reserve the right to add to it as needed. There are already a ton
            // of potential cases that I don't care to handle specifically.
            _ => Status::InternalServerError,
        },
        // There are a bunch of ways an image can be invalid or otherwise
        // unopenable, but I don't see much value in going into them here.
        _ => Status::InternalServerError,
    }
}
```

The body hasn't grown much. I did add a helper function to map `ImageError` variations to appropriate status codes. This is a completely reasonable place to stop, but I wanted to explore even fancier approaches.

## Custom Responder

```rust
#[derive(Debug)]
enum ThumbnailError {
    PathIsInvalidString,
    FailedToOpenImage(ImageError),
    FailedToResize,
}

use self::ThumbnailError::*; // Allows us to omit the prefix

#[get("/thumbnail/<photo_name>")]
fn thumbnail(photo_name: String) -> Result<Content<Vec<u8>>, ThumbnailError> {
    let full_path = Path::new(PHOTO_PATH).join(&photo_name);

    // Now we can name our error cases
    let full_path_str = full_path.to_str().ok_or(PathIsInvalidString)?;

    // We can also stash the underlying Err (or other useful information)
    // for later reference
    let img = image::open(&full_path_str).map_err(FailedToOpenImage)?;

    let thumb = img.thumbnail(500, 500);
    let mut buffer = Vec::new();
    thumb
        .write_to(&mut buffer, image::ImageOutputFormat::JPEG(80))
        .or(Err(FailedToResize))?;

    Ok(Content(ContentType::JPEG, buffer))
}

impl Responder<'static> for ThumbnailError {
    fn respond_to(self, _: &Request) -> Result<Response<'static>, Status> {
        Err(match self {
            PathIsInvalidString => Status::BadRequest,
            FailedToOpenImage(ImageError::IoError(io_err)) => match io_err.kind() {
                NotFound => Status::NotFound,
                PermissionDenied => Status::Forbidden,
                _ => Status::InternalServerError,
            },
            FailedToOpenImage(_) => Status::InternalServerError,
            FailedToResize => Status::InternalServerError,
        })
    }
}
```

This feels a touch heavy, but there some very real readability gains. I'm intrigued by how easy it is to keep the happy path untainted by error handling code. We've named our failures and can see exactly how they map to status codes.

Also, this function is not almost completely decoupled from Rocket. With a bit more tweaking (specifically the final return value) I could use it in a different context.

## Paths not taken

I played with a few other things, but I felt they added even more magical obfuscation with little gain:

- Implementing the [`Try` trait](https://doc.rust-lang.org/std/ops/trait.Try.html). This is a nightly-only experimental API that lets you integrate your custom types with the `?` operator. I didn't actually get it to work, and I'm going to wait for it to stabilize before I revisit. I think an explicit `Result<SuccessType, ErrorType>` will make more sense for most cases.
- Implementing the [`From` trait](https://doc.rust-lang.org/std/convert/trait.From.html). This can cut a bit of verbosity, but it also makes it harder to take context into account. For example, there are two potential `ImageError`s, and we need to handle each differently. I don't think it's worth the effort in this case, but I see a lot of the potential in `From` and `Into`.

## Conclusion

There are a lot of ways to handle failure in Rust. You can opt into quick and dirty "just crash" behavior when you're messing around. For anything remotely serious, more robust approaches are really not much more work. The amount of care the Rust implementers put into ergonomics and composability is truely impressive.
