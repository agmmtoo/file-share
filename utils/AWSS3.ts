import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
} from "../config.ts";
import { AWS_S3_BUCKET_NAME } from "../config.ts";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

export const createPresignedUrl = (key: string) => {
  const client = new S3Client({
    region: AWS_REGION,
  });

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
};

export const getPresignedUrl = async (key: string, expiresIn: number) => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key.toString(),
  });

  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  // generate s3 presigned url
  const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
    expiresIn: expiresIn,
  });

  console.log("presignedUrl: ", presignedUrl);

  return presignedUrl;
};
