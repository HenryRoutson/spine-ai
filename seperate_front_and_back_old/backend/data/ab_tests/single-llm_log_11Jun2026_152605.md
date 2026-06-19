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
    "summary": "Explicit consent required for personal data collection and processing.",
    "rule_id": "1.1",
    "compliant": true,
    "rationale": "The Company has implemented a consent mechanism that ensures explicit, freely given, and informed consent for each distinct purpose of processing.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent required for health data.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "The Company has a process in place to obtain separate, affirmative opt-in consent for health data, recorded and time-stamped at the moment it is given.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be easy and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "The Company has a mechanism that allows Data Subjects to withdraw consent as easily as it is given, and ensures withdrawal takes effect within 72 hours.",
    "liability_usd": 0
  },
  {
    "summary": "Only necessary personal data should be collected and not repurposed.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "The Company adheres to data minimisation principles, collecting only necessary data and not repurposing it for undisclosed uses.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data retention must be limited to the necessary period.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "The Company has policies in place to ensure personal data is retained only as long as necessary, with health data deleted within 24 months of account inactivity.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be encrypted in transit and at rest.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "The Company uses TLS 1.2 or higher for data in transit and AES-256 for data at rest, ensuring robust encryption.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication must be enforced.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "The Company has implemented role-based access control and multi-factor authentication for all personnel accessing personal data.",
    "liability_usd": 0
  },
  {
    "summary": "Independent third-party penetration tests and security audits must be conducted annually.",
    "rule_id": "3.3",
    "compliant": true,
    "rationale": "The Company commissions independent third-party penetration tests and security audits at least once every 12 months.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be stored and processed within the European Economic Area unless an approved transfer mechanism is in place.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "The Company ensures personal data of EEA residents is stored and processed exclusively within the EEA, unless an approved transfer mechanism is used.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must not be transferred to third countries without adequate data protection.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "The Company does not transfer personal data to third countries lacking adequate data protection recognition.",
    "liability_usd": 0
  },
  {
    "summary": "Automated decision-making systems must provide explanations and allow human review.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "The Company provides clear explanations of automated decision-making logic and offers routes to human review.",
    "liability_usd": 0
  },
  {
    "summary": "AI models must be documented with purpose, training data sources, and bias assessments.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "The Company maintains detailed records of AI models, including their purpose, training data sources, and bias assessments.",
    "liability_usd": 0
  },
  {
    "summary": "Automated systems must not make final medical treatment decisions without human clinician approval.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "The Company ensures that automated systems do not make final medical treatment decisions without human clinician review and approval.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors must be bound by protective contractual obligations.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "The Company ensures that all sub-processors are bound by contractual obligations no less protective than those in this Agreement.",
    "liability_usd": 0
  },
  {
    "summary": "A current list of sub-processors must be maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "The Company maintains and publishes an up-to-date list of all sub-processors with access to personal data.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data breaches must be notified to supervisory authorities within 72 hours.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "The Company has a breach notification process in place to inform supervisory authorities within 72 hours of becoming aware of a breach.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be notified of high-risk breaches without undue delay.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "The Company notifies affected Data Subjects without undue delay in the event of a high-risk breach.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be able to access, rectify, and export their personal data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "The Company enables Data Subjects to access, rectify, and export their personal data, fulfilling requests within 30 days.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects' personal data must be deleted upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "The Company promptly deletes Data Subjects' personal data upon request.",
    "liability_usd": 0
  }
]
```