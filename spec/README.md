# spec/

The `automatos-skin/v1` format: `automatos-skin.v1.schema.json`, the JSON Schema a skin's `skin.json` must match.

Studio owns the format (core PRD-259 §3). Until Studio publishes `GET /api/skins/schema`, the copy here implements PRD-259 §3 as a draft and says so (`"x-status": "draft-until-studio-publishes"`). `npm run sync-schema` refreshes it from a running Automatos or a local `automatos-ai` checkout, and records where it came from. Edit the schema in Studio, not here.
