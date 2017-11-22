--------------------------------------------------------------------------------
{-# LANGUAGE OverloadedStrings #-}
import Data.Monoid (mappend)
import Hakyll
import System.FilePath.Posix
    ( takeBaseName
    , takeDirectory
    , (</>)
    , splitFileName
    , joinPath
    , splitPath
    )
import Data.List (isInfixOf)
import Debug.Trace (traceShowId)
import Text.Regex.PCRE ((=~))
import Control.Monad
import Data.Maybe (isJust, isNothing)
import Data.Monoid ((<>))

--------------------------------------------------------------------------------
main :: IO ()
main = hakyll $ do
    match "images/*" $ do
        route   idRoute
        compile copyFileCompiler
    
    match "css/main.scss" $ do
        route $ setExtension "css"
        compile (compileSass "css")

    -- matchMetadata "demos/**" (isJust . lookupString "layout") $ do
    --     route $ setExtension "html"
    --     compile $ pandocCompiler
    --         >>= applyTemplateByField "layout"
    --         >>= relativizeUrls

    -- matchMetadata "demos/**" (isNothing . lookupString "layout") $ do
    --     route idRoute 
    --     compile copyFileCompiler

    match "posts/*" $ do
        route $ customRoute $ postRoute
        compile $ pandocCompiler
            >>= saveSnapshot "content"
            >>= loadAndApplyTemplate "templates/post.html" postCtx
            >>= relativizeUrls
            >>= removeIndexHtml

    create ["archive/index.html"] $ do
        route idRoute
        compile $ do
            posts <- recentFirst =<< loadAll "posts/*"
            let archiveCtx =
                       listField "posts" postCtx (return posts)
                    <> constField "title" "Archives"
                    <> siteCtx

            makeItem ""
                >>= loadAndApplyTemplate "templates/archive.html" archiveCtx
                >>= loadAndApplyTemplate "templates/default.html" archiveCtx
                >>= relativizeUrls
                >>= removeIndexHtml


    match "index.html" $ do
        route idRoute
        compile $ do
            posts <- recentFirst =<< loadAll "posts/*"
            let
                postListCtx =
                       postCtx
                    <> teaserField "teaser" "content"
                    <> snapshotField "fullContent" "content"
                    
                indexCtx =
                       listField "posts" postListCtx (return $ take 5 posts)
                    <> constField "title" "Home"
                    <> siteCtx

            getResourceBody
                >>= applyAsTemplate indexCtx
                >>= loadAndApplyTemplate "templates/default.html" indexCtx
                >>= relativizeUrls
                >>= removeIndexHtml

    match "templates/*" $ compile templateBodyCompiler


--------------------------------------------------------------------------------
postCtx :: Context String
postCtx =
       dateField "timestamp" "%F"
    <> dateField "date" "%b %d, %Y"
    <> constField "layout" "post"
    <> siteCtx

siteCtx :: Context String
siteCtx =
       defaultContext
    <> constField "siteTitle" "Erik Simmler"
    <> constField "author" "Erik Simmler"
    <> constField "feedUrl" "/feed.atom"
    

compileSass :: String -> Compiler (Item String)
compileSass loadPath = do
  fmap (fmap compressCss) $
    getResourceString
    >>= withItemBody (unixFilter "sassc"
        [ "-s"
        , "--load-path", loadPath
        , "--style", "expanded"
        -- , "--style", "compressed"
        -- , "--sourcemap", "inline"
        ])

postRoute :: Identifier -> FilePath
postRoute sourcePath =
    shorten (toFilePath sourcePath) </> fileName (toFilePath sourcePath) </> "index.html"
    where
        fileName :: FilePath -> FilePath
        fileName p =
            case (captureName . takeBaseName) p of
                Just np -> np
                Nothing -> error $ "[ERROR] wrong format: " ++ p

        shorten =
            joinPath . tail . splitPath . takeDirectory

captureName :: String -> Maybe String
captureName raw =
    let found :: [[String]]
        found = raw =~ ("(?:[0-9]{4})\\-(?:[0-9]{2})\\-(?:[0-9]{2})\\-(.+)$" :: String) 
    in
        case drop 1 . join $ found of
            matched : _ -> Just matched
            _ -> Nothing

-- Replace url of the form foo/bar/index.html with foo/bar.
removeIndexHtml :: Item String -> Compiler (Item String)
removeIndexHtml item =
    return $ fmap (withUrls removeIndexStr) item
    where
        removeIndexStr :: String -> String
        removeIndexStr url =
            case splitFileName url of
                (dir, "index.html") | isLocal dir -> dir
                _ -> url

        isLocal :: String -> Bool
        isLocal uri = not (isInfixOf "://" uri)

applyTemplateByField :: String -> Item String -> Compiler (Item String)
applyTemplateByField fieldName item = do
    identifier <- getUnderlying
    metadata <- getMetadata identifier
    case lookupString fieldName metadata of
        Nothing -> return item
        Just name -> loadAndApplyTemplate
            (fromFilePath $ "templates/" ++ name ++ ".html")
            siteCtx item

snapshotField :: String -> Snapshot -> Context String
snapshotField key snapshot =
    field key $ \item -> itemBody <$> loadSnapshot (itemIdentifier item) snapshot