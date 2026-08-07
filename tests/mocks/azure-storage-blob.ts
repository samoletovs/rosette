export const BlobServiceClient = {
  fromConnectionString() {
    throw new Error('Blob storage should not be used for invalid upload requests');
  },
};
