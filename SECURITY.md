# Security reporting

Do not publish credentials, personal/private records, exploit details or restricted datasets in public issues. Ask the maintainer for a private reporting channel before sending sensitive information.

The project includes an offline Python prototype and a static browser application. The browser has no authentication system, API, upload flow, analytics or persistence. It calculates synthetic examples in a local Web Worker; it does not fetch tennis records. Its deployment host may maintain ordinary request logs. The Python CSV inputs should still be treated as untrusted; do not execute downloaded notebooks, scripts or serialized model files merely because they accompany a dataset. The examples and test suites require no provider credentials.

Security fixes should preserve input validation and chronology checks. This notice does not promise a response time, a support window, an audit certification or production readiness.
