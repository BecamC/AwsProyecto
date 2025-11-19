const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.REGION || 'us-east-1';
const client = new S3Client({ region: REGION });

async function uploadImage({ bucket, key, body, contentType }) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await client.send(command);

  return `https://${bucket}.s3.${REGION}.amazonaws.com/${key}`;
}

async function deleteImage({ bucket, key }) {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(command);
}

module.exports = {
  uploadImage,
  deleteImage,
};

