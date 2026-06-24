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
    "rationale": "The Company has implemented a consent mechanism that ensures explicit, freely given, and informed consent is obtained for each distinct purpose.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent must be obtained for health data, recorded and time-stamped.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "The Company has a process in place to obtain separate, affirmative opt-in consent for health data, which is recorded and time-stamped.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be as easy as giving consent and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "The Company has a mechanism that allows consent to be withdrawn as easily as it is given, and withdrawal takes effect within 72 hours.",
    "liability_usd": 0
  },
  {
    "summary": "Only necessary personal data should be collected and not repurposed.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "The Company collects only the personal data strictly necessary for the stated purpose and does not repurpose it.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data should not be retained longer than necessary; health data for no more than 24 months after account inactivity.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "The Company adheres to data retention policies, ensuring personal data is not retained longer than necessary and health data is deleted within 24 months of account inactivity.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be encrypted in transit and at rest using specified standards.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "The Company uses TLS 1.2 or higher for encryption in transit and AES-256 for encryption at rest.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication must be enforced.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "The Company enforces role-based access control and multi-factor authentication for all employees and contractors accessing personal data.",
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
    "summary": "Personal data of EEA residents must be stored and processed within the EEA unless an approved transfer mechanism is in place.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "The Company ensures personal data of EEA residents is stored and processed exclusively within the EEA, with approved transfer mechanisms in place where necessary.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must not be transferred to third countries without adequate data protection.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "The Company does not transfer personal data to third countries that have not been recognized as providing an adequate level of data protection.",
    "liability_usd": 0
  },
  {
    "summary": "Automated or AI-driven systems must provide explanations and routes to human review.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "The Company provides clear explanations of the logic involved in automated decisions and offers routes to human review.",
    "liability_usd": 0
  },
  {
    "summary": "A written record of every AI model used in production must be maintained.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "The Company maintains a written record of every AI model used in production, including its purpose, training data sources, and bias assessment.",
    "liability_usd": 0
  },
  {
    "summary": "No automated system shall make final medical treatment decisions without human clinician review.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "The Company ensures that no automated system makes final medical treatment decisions without the review and approval of a qualified human clinician.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors must be bound by contractual obligations no less protective than this Agreement.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "The Company ensures that all sub-processors are bound by contractual obligations that are no less protective than those in this Agreement.",
    "liability_usd": 0
  },
  {
    "summary": "A current list of all sub-processors with access to personal data must be maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "The Company maintains and publishes a current list of all sub-processors that have access to personal data.",
    "liability_usd": 0
  },
  {
    "summary": "Breaches must be notified to the supervisory authority within 72 hours.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "The Company has a process in place to notify the relevant supervisory authority of any personal data breach within 72 hours of becoming aware of it.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be notified of breaches likely to result in a high risk to their rights.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "The Company notifies affected Data Subjects without undue delay in the event of a breach likely to result in a high risk to their rights.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be able to access, rectify, and export their personal data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "The Company enables Data Subjects to access, rectify, and export their personal data, fulfilling such requests within 30 days.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be deleted upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "The Company deletes a Data Subject’s personal data upon request, in compliance with data protection regulations.",
    "liability_usd": 0
  }
]
```