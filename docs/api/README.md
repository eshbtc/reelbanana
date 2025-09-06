# ReelBanana API Documentation

This folder contains OpenAPI 3.0 specifications and a Postman collection for all Cloud Run services used by ReelBanana.

## Security
- App Check: All Cloud Run services require an App Check token via `X-Firebase-AppCheck`.
- Firebase Auth: The API Key Service additionally requires a Firebase ID token via `Authorization: Bearer <idToken>`.

## Error Format
All services return standardized errors:

```
{
  "code": "<ERROR_CODE>",
  "message": "Human-readable description",
  "details": "Optional more info",
  "requestId": "UUID"
}
```

## Services
- Upload Assets: `upload-assets.yaml`
- Narrate (TTS): `narrate.yaml`
- Align Captions: `align-captions.yaml`
- Compose Music: `compose-music.yaml`
- Render Video: `render.yaml`
- API Key Service: `api-key-service.yaml`

See the Postman collection in `postman/` to try the endpoints quickly.

