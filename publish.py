import paraflow
from subprocess import check_call
import os

dry_run = os.environ.get('DRY_RUN')


def aws():
    if not dry_run:
        check_call(['pip', 'install', '--user', '--quiet', 'awscli'])
    return 'aws'


def zola():
    try:
        check_call(['which', 'zola'])
        return 'zola'
    except:
        zola_url = 'https://github.com/getzola/zola/releases/download/v0.16.1/zola-v0.16.1-x86_64-unknown-linux-gnu.tar.gz'
        check_call(f'wget -qO- {zola_url} | tar -xvz', shell=True)
        return './zola'


def staging_prefix():
    pr_number = os.environ.get('CIRCLE_PR_NUMBER')
    if pr_number:
        return f'pr-{pr_number}'

    branch = os.environ.get('CIRCLE_BRANCH') or 'HEAD'
    if branch == 'master':
        return ''
    else:
        return branch


def built_base_url(zola, staging_prefix):
    base_url = 'https://esimmler.com'
    if staging_prefix:
        base_url = f'http://staging.esimmler.com.s3-website-us-east-1.amazonaws.com/{staging_prefix}'
    check_call([zola, 'build', '--base-url', base_url])
    check_call(['cp', 'public/rss.xml', 'public/feed.atom'])
    return base_url


def upload(built_base_url, aws, staging_prefix):
    s3_url = 's3://esimmler.com/'
    if staging_prefix:
        s3_url = f's3://staging.esimmler.com/{staging_prefix}/'

    cmd = [aws, 's3', 'sync', 'public', s3_url, '--delete']
    if dry_run:
        cmd.append('--dryrun')
    check_call(cmd)

    print(built_base_url)


if __name__ == "__main__":
    paraflow.run(upload)
