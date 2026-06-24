# A/B log — single-llm on deepseek-v3



## single-llm

One structured call.

```text
You are a legal compliance engine. Read the document, derive its obligations, and produce a per-rule compliance assessment (concise summary, rule_id, compliant verdict, brief rationale, liability_usd if non-compliant).

DOCUMENT:
Health Data Protection and AI Governance Agreement
OFFICE OF HEALTH DATA PROTECTION, Supervisory Authority, European Union
This Agreement sets out the binding obligations…
```

Output:

```json
[
  {
    "summary": "Explicit consent must be obtained for each distinct purpose of processing personal data.",
    "rule_id": "1.1",
    "compliant": true,
    "rationale": "The Company ensures explicit, freely given, and informed consent is obtained for each processing purpose.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent must be obtained for health data, recorded and time-stamped.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "The Company obtains separate, affirmative opt-in consent for health data, ensuring it is recorded and time-stamped.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be as easy as giving consent and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "The Company provides an easy mechanism for consent withdrawal, ensuring it takes effect within 72 hours.",
    "liability_usd": 0
  },
  {
    "summary": "Only strictly necessary personal data should be collected and not repurposed.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "The Company collects only necessary data and does not repurpose it for undisclosed uses.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data should not be retained longer than necessary; health data for no more than 24 months after account inactivity.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "The Company adheres to data retention limits, ensuring health data is not retained beyond 24 months after account inactivity.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be encrypted in transit using TLS 1.2 or higher and at rest using AES-256 or equivalent.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "The Company uses TLS 1.2 for transit encryption and AES-256 for at-rest encryption.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication must be enforced for personal data access.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "The Company enforces role-based access control and multi-factor authentication for all personal data access.",
    "liability_usd": 0
  },
  {
    "summary": "Independent third-party penetration tests and security audits must be conducted annually.",
    "rule_id": "3.3",
    "compliant": true,
    "rationale": "The Company commissions annual independent third-party penetration tests and security audits.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data of EEA residents must be stored and processed exclusively within the EEA unless an approved transfer mechanism is in place.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "The Company ensures EEA resident data is stored and processed within the EEA or with an approved transfer mechanism.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must not be transferred to third countries without adequate data protection recognition.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "The Company does not transfer personal data to third countries lacking adequate data protection recognition.",
    "liability_usd": 0
  },
  {
    "summary": "Automated or AI-driven decisions affecting Data Subjects must include a clear explanation and route to human review.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "The Company provides clear explanations and human review routes for AI-driven decisions affecting Data Subjects.",
    "liability_usd": 0
  },
  {
    "summary": "A written record of every AI model used in production must be maintained, including purpose, training data sources, and bias assessment.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "The Company maintains detailed records of AI models, including purpose, training data, and bias assessments.",
    "liability_usd": 0
  },
  {
    "summary": "No automated system shall make final medical treatment decisions without human clinician review and approval.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "The Company ensures all medical treatment decisions by automated systems are reviewed and approved by a human clinician.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors handling personal data must be bound by contractual obligations no less protective than this Agreement.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "The Company ensures sub-processors are bound by equally protective contractual obligations.",
    "liability_usd": 0
  },
  {
    "summary": "A current list of all sub-processors with access to personal data must be maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "The Company maintains and publishes an up-to-date list of all sub-processors with personal data access.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data breaches must be notified to the supervisory authority within 72 hours of awareness.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "The Company promptly notifies the supervisory authority of personal data breaches within 72 hours.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be notified without undue delay if a breach poses a high risk to their rights.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "The Company notifies affected Data Subjects promptly if a breach poses a high risk to their rights.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be able to access, rectify, and export their personal data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "The Company enables Data Subjects to access, rectify, and export their personal data within 30 days.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects' personal data must be deleted within the specified timeframe upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "The Company promptly deletes Data Subjects' personal data upon request within the specified timeframe.",
    "liability_usd": 0
  }
]
```