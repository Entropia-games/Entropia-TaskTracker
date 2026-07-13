import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

export const ourFileRouter = {
  image: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(({ file }) => ({ url: file.url })),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
