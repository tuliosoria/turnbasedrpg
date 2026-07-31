# Turn Image Upload Design

## Goal

Allow the admin to upload a local image in the existing Turnos tab for both "Imagem do evento" and "Imagem do resultado".

## User experience

Each existing `TurnImagePanel` keeps the current AI generation, preview, and remove controls. A new "Enviar imagem" button opens the system file picker and accepts PNG, JPEG, or WebP files. After upload, the panel refreshes through the existing admin action flow and shows the uploaded image in the same preview position used by generated images.

## Architecture

The frontend sends a `multipart/form-data` request to a new admin endpoint, `/api/admin/turn/image/upload`, with two fields: `kind` (`event` or `result`) and `image` (the selected file). The backend decodes multipart payloads in the Lambda handler, validates the admin token and active turn, validates file type and size, stores the image in the existing image S3 bucket, and writes the resulting URL to the active turn with `setTurnImage`.

## Validation and errors

The backend accepts `image/png`, `image/jpeg`, and `image/webp` only. The image file body must be non-empty and at most 10 MB. Invalid request bodies return `INVALID_BODY`; missing image storage returns `IMAGE_DISABLED`; storage failures keep using `IMAGE_ERROR`; no active turn returns `BAD_STATUS`.

## Data and storage

Uploaded files reuse the existing `turns/<turn-id>/<kind>.<extension>` key pattern. AI-generated images continue to be stored as PNG. Uploaded PNG, JPEG, and WebP files keep their own content type and extension so browsers receive the correct asset metadata.

## Testing

Backend tests cover upload success, unsupported file type, oversized file, missing image storage, auth, router dispatch, and S3 content type/key behavior. Frontend tests cover the HTTP multipart request, mock client behavior, and the Admin Turnos UI calling the upload method from both image panels.

