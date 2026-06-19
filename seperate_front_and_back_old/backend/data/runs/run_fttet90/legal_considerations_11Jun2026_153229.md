# Legal Considerations

## R-01 — Non-compliant
MediFlow AI collects user data under a single checkbox consent, which does not explicitly separate purposes like analytics, marketing, and health processing.

Explicit consent must be obtained for each distinct purpose of personal data processing, which is not currently practiced.

**Estimated exposure:** $500000

## R-02 — Non-compliant
MediFlow AI collects health data without a separate, affirmative opt-in consent that is recorded and time-stamped.

Health data requires a separate, affirmative opt-in consent recorded and time-stamped, which is not implemented.

**Estimated exposure:** $500000

## R-03 — Non-compliant
MediFlow AI encrypts data in transit using TLS 1.3 but does not encrypt data at rest.

Personal data must be encrypted both in transit using TLS 1.2 or higher and at rest using AES-256 or equivalent, which is not fully met.

**Estimated exposure:** $500000

## R-04 — Non-compliant
MediFlow AI stores and processes EEA residents' data in the US without an approved transfer mechanism.

Personal data of EEA residents must be stored and processed exclusively within the EEA unless an approved transfer mechanism is in place, which is not the case.

**Estimated exposure:** $500000

## R-06 — Non-compliant
MediFlow AI's incident-response runbook states that confirmed data breaches are to be reported within five business days, exceeding the 72-hour requirement.

In the event of a personal data breach, the Company must notify the supervisory authority within 72 hours, which is not adhered to.

**Estimated exposure:** $500000

## R-05 — Compliant
MediFlow AI's triage engine provides explanations for automated decisions and routes urgent cases for human review.

Automated systems must provide a clear explanation of logic and offer a route to human review for decisions affecting Data Subjects, which is implemented.
