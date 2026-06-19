# A/B benchmark — Company Legal Evaluation
Cheap model: deepseek-v3 · fallback used: false

- **single-llm** (deepseek-v3): accuracy 95%, pass 100%, 76948ms, 0.36c
- **cheap-agent** (deepseek-v3): accuracy 95%, pass 100%, 164608ms, 0.83c

**Winner:** single-llm
The single-llm strategy outperforms the cheap-agent strategy in terms of latency and cost while maintaining equivalent schema reliability and output quality. Both strategies achieved 100% schema pass rates and similar accuracy in their outputs, but the single-llm strategy is significantly faster and cheaper.

---

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
# A/B log — cheap-agent on deepseek-v3



## cheap-agent (agent loop)

draft → validate → critique → revise

### draft

```json
[
  {
    "summary": "Explicit consent required for personal data collection and processing.",
    "rule_id": "1.1",
    "compliant": true,
    "rationale": "The Company ensures explicit consent is obtained for each distinct purpose.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent required for health data.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "Affirmative opt-in consent is recorded and time-stamped for health data.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be easy and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "Consent withdrawal process is straightforward and timely.",
    "liability_usd": 0
  },
  {
    "summary": "Only necessary personal data should be collected.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "Data collection is limited to what is strictly necessary.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data retention must be limited.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "Data retention policies ensure data is not kept longer than necessary.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be encrypted in transit and at rest.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "Encryption standards meet or exceed industry requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication enforced.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "Access controls are robust and secure.",
    "liability_usd": 0
  },
  {
    "summary": "Independent third-party penetration tests and security audits required annually.",
    "rule_id": "3.3",
    "compliant": true,
    "rationale": "Regular security assessments are conducted.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be stored and processed within the European Economic Area.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "Data residency complies with EEA requirements.",
    "liability_usd": 0
  },
  {
    "summary": "No transfer of personal data to third countries without adequate protection.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "Data transfers comply with protection standards.",
    "liability_usd": 0
  },
  {
    "summary": "Automated decision-making systems must provide explanations and human review.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "Transparency and human oversight are ensured.",
    "liability_usd": 0
  },
  {
    "summary": "AI models must be documented with purpose, training data, and bias assessment.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "Comprehensive documentation of AI models is maintained.",
    "liability_usd": 0
  },
  {
    "summary": "No final medical treatment decisions by automated systems without human clinician review.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "Human oversight is mandatory for medical decisions.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors must have equivalent protective obligations.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "Sub-processors are bound by stringent contractual obligations.",
    "liability_usd": 0
  },
  {
    "summary": "Current list of sub-processors must be maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "Sub-processor list is up-to-date and accessible.",
    "liability_usd": 0
  },
  {
    "summary": "Breach notification to supervisory authority within 72 hours.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "Timely breach notification procedures are in place.",
    "liability_usd": 0
  },
  {
    "summary": "Notification to Data Subjects in case of high-risk breaches.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "Affected Data Subjects are promptly informed.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be able to access, rectify, and export their data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "Data Subject rights are fully supported.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be deleted upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "Data deletion requests are promptly fulfilled.",
    "liability_usd": 0
  }
]
```

### critique & revise

```json
[
  {
    "summary": "Explicit consent required for personal data collection and processing.",
    "rule_id": "1.1",
    "compliant": true,
    "rationale": "The Company ensures explicit consent is obtained for each distinct purpose, meeting the requirement for informed and freely given consent.",
    "liability_usd": 0
  },
  {
    "summary": "Separate opt-in consent required for health data.",
    "rule_id": "1.2",
    "compliant": true,
    "rationale": "Affirmative opt-in consent is recorded and time-stamped for health data, ensuring compliance with heightened consent requirements.",
    "liability_usd": 0
  },
  {
    "summary": "Consent withdrawal must be easy and take effect within 72 hours.",
    "rule_id": "1.3",
    "compliant": true,
    "rationale": "The Company provides a straightforward and timely consent withdrawal process, ensuring compliance with the 72-hour requirement.",
    "liability_usd": 0
  },
  {
    "summary": "Only necessary personal data should be collected.",
    "rule_id": "2.1",
    "compliant": true,
    "rationale": "Data collection is limited to what is strictly necessary, adhering to the principle of data minimisation.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data retention must be limited.",
    "rule_id": "2.2",
    "compliant": true,
    "rationale": "Data retention policies ensure data is not kept longer than necessary, with health data deleted within 24 months of account inactivity.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be encrypted in transit and at rest.",
    "rule_id": "3.1",
    "compliant": true,
    "rationale": "Encryption standards meet or exceed industry requirements, with TLS 1.2 or higher for transit and AES-256 for at-rest encryption.",
    "liability_usd": 0
  },
  {
    "summary": "Role-based access control and multi-factor authentication enforced.",
    "rule_id": "3.2",
    "compliant": true,
    "rationale": "Access controls are robust and secure, with role-based access and multi-factor authentication implemented for all personnel.",
    "liability_usd": 0
  },
  {
    "summary": "Independent third-party penetration tests and security audits required annually.",
    "rule_id": "3.3",
    "compliant": true,
    "rationale": "Regular security assessments are conducted annually by independent third parties, ensuring ongoing compliance.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be stored and processed within the European Economic Area.",
    "rule_id": "4.1",
    "compliant": true,
    "rationale": "Data residency complies with EEA requirements, with no storage or processing outside the EEA without approved mechanisms.",
    "liability_usd": 0
  },
  {
    "summary": "No transfer of personal data to third countries without adequate protection.",
    "rule_id": "4.2",
    "compliant": true,
    "rationale": "Data transfers comply with protection standards, ensuring no transfers to third countries lacking adequate protection.",
    "liability_usd": 0
  },
  {
    "summary": "Automated decision-making systems must provide explanations and human review.",
    "rule_id": "5.1",
    "compliant": true,
    "rationale": "Transparency and human oversight are ensured, with clear explanations and routes for human review provided.",
    "liability_usd": 0
  },
  {
    "summary": "AI models must be documented with purpose, training data, and bias assessment.",
    "rule_id": "5.2",
    "compliant": true,
    "rationale": "Comprehensive documentation of AI models is maintained, including purpose, training data, and bias assessments.",
    "liability_usd": 0
  },
  {
    "summary": "No final medical treatment decisions by automated systems without human clinician review.",
    "rule_id": "5.3",
    "compliant": true,
    "rationale": "Human oversight is mandatory for medical decisions, ensuring no final treatment decisions are made without clinician review.",
    "liability_usd": 0
  },
  {
    "summary": "Sub-processors must have equivalent protective obligations.",
    "rule_id": "6.1",
    "compliant": true,
    "rationale": "Sub-processors are bound by stringent contractual obligations equivalent to those in this Agreement.",
    "liability_usd": 0
  },
  {
    "summary": "Current list of sub-processors must be maintained and published.",
    "rule_id": "6.2",
    "compliant": true,
    "rationale": "Sub-processor list is up-to-date and accessible, ensuring transparency and compliance.",
    "liability_usd": 0
  },
  {
    "summary": "Breach notification to supervisory authority within 72 hours.",
    "rule_id": "7.1",
    "compliant": true,
    "rationale": "Timely breach notification procedures are in place, ensuring compliance with the 72-hour requirement.",
    "liability_usd": 0
  },
  {
    "summary": "Notification to Data Subjects in case of high-risk breaches.",
    "rule_id": "7.2",
    "compliant": true,
    "rationale": "Affected Data Subjects are promptly informed in cases of high-risk breaches, ensuring compliance.",
    "liability_usd": 0
  },
  {
    "summary": "Data Subjects must be able to access, rectify, and export their data within 30 days.",
    "rule_id": "8.1",
    "compliant": true,
    "rationale": "Data Subject rights are fully supported, with requests fulfilled within the 30-day requirement.",
    "liability_usd": 0
  },
  {
    "summary": "Personal data must be deleted upon request.",
    "rule_id": "8.2",
    "compliant": true,
    "rationale": "Data deletion requests are promptly fulfilled, ensuring compliance with deletion obligations.",
    "liability_usd": 0
  }
]
```