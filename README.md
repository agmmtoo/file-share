# file-share

🦖 [Deno](https://deno.com/) + 🔥 [Hono](https://hono.dev/)

## App

[file-share.deno.dev](https://file-share.deno.dev/)

## Tech Stack

- [Deno](https://deno.com/)
- [Hono](https://hono.dev/)
- [DenoKv](https://deno.com/kv/)
- [S3](https://aws.amazon.com/s3/)
- [Deno Deploy](https://deno.com/deploy)
- [TypeScript](https://www.typescriptlang.org/)

## Run

```
deno task start
```

## How it works

tl;dr: Upload file, get link, share link.

1. File is uploaded to S3.
2. A presigned URL is generated and stored in metadata.
3. File metadata is stored in DenoKv.
4. Link is generated and returned to the user.

## Todo

- [x] Basic features
- [ ] Write README
- [ ] Add file expiration
- [x] Add file size limit
- [ ] Add file type limit
- [ ] Add file download limit
- [ ] Add file download count limit
- [ ] Add file password protection
- [ ] Add file encryption
- [ ] Add file compression
- [ ] Add file comments

## Note

S3 Bucket > Permissions > CORS configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET","PUT"],
    "AllowedOrigins": ["https://file-share.deno.dev"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```
