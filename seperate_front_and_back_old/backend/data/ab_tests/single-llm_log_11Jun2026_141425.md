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
    "rationale": "The Company obtains explicit consent for each processing purpose.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent required for health data.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "Affirmative opt-in consent is recorded and time-stamped.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be easy and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "Consent withdrawal process is implemented effectively.",
    "liability_usd": 0
  },
  {
    "summary": "Only necessary personal data collected and not repurposed.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "Data collection aligns with stated purposes.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data retained only as long as necessary; health data for max 24 months after inactivity.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "Data retention policies comply with requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data encrypted in transit and at rest.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "Encryption standards meet or exceed requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication enforced.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "Access controls are implemented as required.",
    "liability_usd": 0
  },
  {
    "summary": "Independent third-party penetration test and security audit conducted annually.",
    "rule_id": "3.3",
    "compliant": true,
    "rationale": "Security audits are performed within the required timeframe.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data stored and processed within the European Economic Area unless approved transfer mechanism exists.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "Data residency complies with EEA requirements.",
    "liability_usd": 0
  },
  {
    "summary": "No transfer of personal data to third countries without adequate data protection.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "Transfers comply with adequacy requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Automated decision-making systems provide explanations and human review options.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "AI systems include logic explanations and human review.",
    "liability_usd": 0
  },
  {
    "summary": "Written records maintained for AI models, including purpose, training data, and bias assessment.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "AI model documentation is complete and maintained.",
    "liability_usd": 0
  },
  {
    "summary": "No final automated decisions on medical treatment without human clinician review.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "Human review is required for medical treatment decisions.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors bound by protective contractual obligations.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "Sub-processors meet contractual requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Current list of sub-processors maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "Sub-processor list is up-to-date and accessible.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data breaches reported to supervisory authority within 72 hours.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "Breach notification timelines are adhered to.",
    "liability_usd": 0
  },
  {
    "summary": "High-risk breaches notified to affected Data Subjects without undue delay.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "Affected Data Subjects are promptly notified.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects can access, rectify, and export personal data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "Data Subject rights are fulfilled within the required timeframe.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data deleted upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "Data deletion requests are processed promptly.",
    "liability_usd": 0
  }
]
```