# Lawsuit Prevention: Legal & Regulatory Checklist for Websites

> **Not legal advice.** Use this as an engineering/product audit checklist. Laws vary by jurisdiction, sector, and facts. Engage qualified counsel before launch or when handling sensitive data.

---

## 1. EU / UK Data Protection (GDPR & UK GDPR)

| Area | What to watch for | Typical failure modes |
|------|-------------------|----------------------|
| **Lawful basis** | Every processing activity needs a valid basis: consent, contract, legal obligation, vital interests, public task, or legitimate interests (with balancing test). | Bundled consent; no documented basis; relying on consent when contract or legitimate interests is more appropriate. |
| **Consent (Art. 7)** | Freely given, specific, informed, unambiguous; separate toggles per purpose; as easy to withdraw as to give. | Single checkbox for ToS + marketing + analytics + health data; pre-ticked boxes; dark patterns blocking withdrawal. |
| **Transparency (Art. 12–14)** | Privacy notice at collection: controller identity, DPO contact, purposes, legal bases, recipients, transfers, retention, rights, complaint authority. | Vague policy; missing sub-processors; policy not updated when product changes. |
| **Data minimisation (Art. 5)** | Collect only what is necessary for the stated purpose. | GPS, contacts, or health data collected “for future features”; excessive profiling fields. |
| **Purpose limitation** | No repurposing without a new lawful basis and notice. | Using signup data for unrelated marketing or model training without disclosure. |
| **Storage limitation** | Defined retention periods; automated deletion where possible. | Indefinite retention; “we keep everything for AI retraining.” |
| **Accuracy** | Mechanisms to correct inaccurate data. | No self-service correction; stale health records. |
| **Integrity & confidentiality** | Appropriate technical and organisational measures (TOMs). | Weak access controls; no encryption at rest; shared admin passwords. |
| **Accountability** | Records of processing (RoPA); DPIAs for high-risk processing; DPO when required (Art. 37). | No RoPA; no DPIA for health/AI/large-scale profiling; no DPO at 10k+ health subjects. |
| **Data subject rights** | Access, rectification, erasure, restriction, portability, objection; respond within **1 month** (extendable to 3). | No export API; erasure only manual; ignoring objections to marketing. |
| **Processor contracts (Art. 28)** | DPAs with every vendor that processes personal data on your behalf. | Using Supabase/Stripe/OpenAI without signed DPAs and transfer terms. |
| **Breach notification (Art. 33–34)** | Notify supervisory authority within **72 hours** if risk; notify individuals if high risk. | No incident playbook; delayed disclosure. |
| **Fines & liability** | Up to €20M or 4% global turnover (GDPR); private claims and class actions increasing in EU. | Treating compliance as “legal dept only.” |

### Special category data (Art. 9) — health, biometrics, etc.

- Requires **explicit consent** or another Art. 9(2) exception (e.g. healthcare provision).
- Higher bar for DPIA, security, and access logging.
- National laws may impose additional health-record rules (e.g. Germany BDSG, France, Netherlands).

### ePrivacy / PECR (cookies & electronic marketing)

| Requirement | Risk |
|-------------|------|
| **Prior consent** before non-essential cookies/trackers (analytics, ads, A/B tools) | Loading Google Analytics / Meta Pixel before consent. |
| **Clear information** about each category of cookie | Generic “we use cookies” banner with only Accept All. |
| **Withdraw consent** as easily as given | No cookie settings page; consent buried in account deletion. |
| **Electronic marketing** (email, SMS, push) | No opt-in for marketing; bought lists; no unsubscribe. |
| **Soft opt-in** exception | Only for similar products to existing customers who didn’t opt out — narrow and national-law dependent. |

---

## 2. International Data Transfers

| Mechanism | When it applies |
|-----------|-----------------|
| **Adequacy decision** | Transfer to countries on EU adequacy list (e.g. UK, Switzerland, Japan — check current list). |
| **Standard Contractual Clauses (SCCs)** | US and most third countries; must complete transfer impact assessment (TIA). |
| **Binding Corporate Rules** | Large multinationals. |
| **Derogations (Art. 49)** | Narrow — explicit consent, contract necessity; not a default for US cloud hosting. |

**Common lawsuit triggers:** EU user data in **US regions** (AWS us-east-1) without SCCs + TIA; Schrems II / Cloud Act exposure; subprocessors in non-adequate countries not disclosed.

---

## 3. Children & Minors

### EU — GDPR Art. 8 + national age thresholds

| Country pattern | Rule of thumb |
|-----------------|---------------|
| **Default** | Parental consent required below **16** (member states may lower to **13**). |
| **UK** | Age of digital consent **13** (Children’s Code / ICO). |
| **Information society services** | Consent, parental verification, child-appropriate privacy notices. |

**Risks:** Allowing under-13/16 signup without age gate or parental flow; profiling children; behavioral advertising to minors (banned or restricted in several EU contexts).

### US — COPPA (under 13)

- Verifiable parental consent before collecting personal info from children under 13.
- Applies if you **know** or **target** children.
- FTC enforcement; state AG actions.

### Other

- **California (CPRA):** Additional protections for minors under 16 (opt-in for sale/share).
- **Australia Online Safety Act,** **Canada PIPEDA** provincial variations.
- **Design codes:** UK Age Appropriate Design Code; similar initiatives in EU (DSA minors’ protections).

**Website checklist:** Age verification or self-declaration + block/walled garden; no dark patterns on children; no unnecessary data collection; parental dashboard for account control and deletion.

---

## 4. Accessibility

| Standard / law | Scope |
|----------------|-------|
| **WCAG 2.1/2.2 Level AA** | De facto global technical standard; referenced by many laws. |
| **EU Web Accessibility Directive** | Public sector websites/apps; increasingly expected of private B2G contractors. |
| **European Accessibility Act (EAA)** | From **28 June 2025** — many private sector products/services (e-commerce, banking, e-books, transport, etc.) must meet accessibility requirements. |
| **UK Equality Act 2010** | Reasonable adjustments; EHRC guidance on web accessibility. |
| **US ADA Title III** | Courts increasingly treat websites of public accommodations as covered; **Section 508** for federal contractors. |
| **California Unruh / CCPA-related suits** | Accessibility + privacy crossover litigation. |

**Common failures (lawsuit bait):**

- No keyboard navigation; focus traps in modals.
- Missing or incorrect **alt text**; images of text without text alternative.
- Poor **color contrast**; information conveyed by color alone.
- Inaccessible forms (no labels, error messages not announced to screen readers).
- Auto-playing media without controls.
- PDFs and downloads not tagged/accessible.
- No **skip links**; improper heading hierarchy.
- Custom components (dropdowns, date pickers) without ARIA.
- “Overlay” widgets marketed as instant compliance (often insufficient and can make things worse).

**Process:** Test with automated tools (axe, Lighthouse) **and** manual keyboard + screen reader testing; document remediation; publish an **accessibility statement** with contact for issues.

---

## 5. Consumer Protection & Unfair Commercial Practices

| Topic | Issue |
|-------|-------|
| **EU Consumer Rights Directive** | Pre-contract information, right of withdrawal (14 days) for distance contracts where applicable. |
| **Unfair Commercial Practices Directive** | Misleading claims, hidden fees, fake urgency, fake reviews. |
| **Digital Services Act (DSA)** | Transparency for online platforms; notice-and-action; complaint mechanisms; recommender system transparency for large platforms. |
| **Dark patterns** | EU and national regulators actively enforcing manipulative UI (hard to cancel, trick questions, confirmshaming). |
| **Pricing** | All-in pricing (EU); drip pricing; currency clarity. |
| **Subscription traps** | Easy cancellation — FTC and EU focus; “click to cancel” rules in several jurisdictions. |

---

## 6. E-Commerce, Payments & Tax

| Area | Risk |
|------|------|
| **PCI DSS** | Storing card data yourself; use tokenized payment providers (Stripe, etc.) and never log PAN/CVV. |
| **PSD2 / SCA** | Strong Customer Authentication for EU card payments. |
| **VAT / sales tax** | MOSS for EU digital services; US state nexus; incorrect invoicing. |
| **Refund policies** | Must match advertised terms and consumer law minima. |
| **Merchant of record** | Clear who the contracting party is on invoices and ToS. |

---

## 7. Terms of Service, Privacy Policy & Contract Formation

- **Clickwrap vs browsewrap:** Enforceable acceptance usually requires clear assent (checkbox + link at signup), not buried footer links alone.
- **Unfair contract terms (EU):** One-sided liability caps, mandatory arbitration, unilateral change clauses may be void for consumers.
- **Governing law & jurisdiction:** Consumer cannot always be stripped of home-country protections.
- **Limitation of liability:** Caps may not apply to gross negligence, personal injury, or statutory rights.
- **Medical / professional disclaimers:** “Not a doctor” disclaimers do not replace regulatory approval for medical devices or clinical software.
- **Versioning:** Archive policy versions; show what users agreed to and when.

---

## 8. Intellectual Property & Content

| Risk | Mitigation |
|------|------------|
| **Copyright** | User uploads (DMCA in US, EU Copyright Directive Art. 17 for certain platforms). |
| **Trademark** | Domain, app name, and UI copy infringing existing marks. |
| **Open-source licenses** | GPL/copyleft obligations if bundling OSS; attribution requirements. |
| **Fonts & stock assets** | Unlicensed commercial use. |
| **Scraping third-party data** | Contract and database rights (EU Database Directive / sui generis). |
| **AI training on user content** | ToS must disclose; opt-out where required; IP infringement from model outputs. |

---

## 9. AI, Automated Decisions & Profiling (GDPR Art. 22)

- **Significant decisions** solely automated require suitable safeguards: human intervention, right to contest, meaningful information about logic.
- **Profiling** triggers transparency and often DPIA.
- **EU AI Act** (phased): Risk classification — prohibited practices, high-risk systems (e.g. medical, employment, credit) need conformity assessments, logging, human oversight.
- **Liability for bad AI advice** especially in health/finance — product liability, negligence, misrepresentation.

**Health-specific:** AI symptom triage may be a **medical device** (EU MDR, UK UKCA, US FDA SaMD) — separate from privacy law and often higher stakes.

---

## 10. Sector-Specific (if applicable)

### Health / digital health

- **GDPR Art. 9** explicit consent or healthcare legal basis.
- **HIPAA** (US covered entities and business associates).
- **EU MDR / IVDR** — software as medical device.
- **Professional regulation** — practicing medicine without a license.
- **Clinical trial rules** if research use of data.

### Financial services

- **PCI DSS,** AML/KYC, **MiFID II,** consumer credit laws, **PSD2.**

### Employment / HR tech

- **Works council consultation,** automated decision restrictions, cross-border employee data.

### Education

- **FERPA** (US), student data protection laws, parental rights.

---

## 11. Security, Breach & Cyber Regulations

| Framework | Notes |
|-----------|-------|
| **GDPR security (Art. 32)** | Encryption, pseudonymisation, resilience, testing. |
| **NIS2 Directive** | Essential/important entities — incident reporting, supply chain security (EU). |
| **UK Cyber Essentials / DORA** | Financial sector operational resilience. |
| **State breach laws** | US all 50 states — notification timelines vary. |
| **Negligence / duty of care** | Failure to patch known vulnerabilities; credential stuffing from no MFA. |

**Lawsuit vectors:** Class actions after breaches; regulatory fines; contractual indemnities from enterprise customers.

---

## 12. Marketing, Advertising & Spam

| Law | Requirement |
|-----|-------------|
| **GDPR + ePrivacy** | Opt-in marketing; granular preferences. |
| **CAN-SPAM (US)** | Opt-out, physical address, honest subject lines. |
| **CASL (Canada)** | Express consent for commercial email. |
| **EU Digital Services / Influencer rules** | Disclose ads and affiliate links (#ad). |
| **Comparative advertising** | Truthful, not denigrating; substantiate claims. |
| **Health claims** | EU Regulation on nutrition/health claims; FTC/FDA for US health products. |

---

## 13. Platform & User-Generated Content

- **DSA** obligations scale with size: illegal content notice-and-action, transparency reports, crisis protocols.
- **Section 230 (US)** — limited immunity; not absolute for federal criminal law, IP, FOSTA-SESTA.
- **Defamation / libel** if you publish or algorithmically amplify harmful UGC.
- **Moderation consistency** — discrimination claims if arbitrary.

---

## 14. Employment & Workplace (if internal tools or monitoring)

- Employee monitoring (keystroke, webcam) — works council, GDPR employment rules, US state privacy laws.
- **Whistleblower directives** (EU) for reporting channels.

---

## 15. US State Privacy Laws (beyond GDPR)

| Law | Highlights |
|-----|------------|
| **CCPA/CPRA (California)** | Right to know, delete, correct, opt-out of sale/share, limit sensitive data; **global privacy control** signals. |
| **Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, etc.** | Similar consumer privacy rights — patchwork compliance. |
| **BIPA (Illinois)** | Biometric data — written consent, retention schedule; private right of action. |
| **Wiretap / session replay** | Recording clicks/keystrokes without consent (class actions against analytics vendors). |

---

## 16. Operational & Governance Checklist

- [ ] **Data Protection Impact Assessment** for high-risk processing (health, children, large-scale monitoring, AI).
- [ ] **Records of Processing Activities** maintained and current.
- [ ] **DPO** appointed and published where required.
- [ ] **Sub-processor register** public and contractual.
- [ ] **Cookie consent** platform integrated before non-essential scripts load.
- [ ] **Age gate** or no minor accounts without parental flow.
- [ ] **DSAR workflow** — access, export (machine-readable), delete within statutory deadlines.
- [ ] **Incident response plan** — 72-hour regulator notification playbook.
- [ ] **Accessibility statement** + WCAG 2.2 AA remediation roadmap.
- [ ] **ToS / Privacy Policy** versioned; separate health/marketing consents.
- [ ] **Vendor DPAs** and transfer mechanisms for all cloud/AI providers.
- [ ] **Penetration test** schedule documented.
- [ ] **Insurance** — cyber liability, professional indemnity (esp. health/legal AI).

---

## 17. High-Risk Patterns Seen in Compliance Audits

These map to common real-world gaps (e.g. health apps with EU users):

1. Single checkbox consent for ToS, privacy, marketing, and health processing.
2. Health/special-category data without explicit opt-in or separate legal basis.
3. Indefinite retention for “model retraining.”
4. EU personal data hosted in US without documented transfer safeguards.
5. No encryption at rest on production databases.
6. MFA optional for staff with production data access.
7. No DPO despite >10k data subjects or large-scale health processing.
8. Automated triage/treatment suggestions without human-clinician review pathway.
9. Collecting location/contacts unused — fails minimisation and increases breach impact.
10. No published sub-processor list or AI model documentation.
11. Analytics/tracking cookies before consent.
12. No accessibility testing — ADA/EAA exposure.
13. Allowing minors to sign up without parental consent mechanism.

---

## 18. Jurisdiction Quick Reference

| Region | Primary frameworks |
|--------|-------------------|
| **EU/EEA** | GDPR, ePrivacy, DSA, AI Act, EAA, NIS2, sector regs |
| **UK** | UK GDPR, PECR, ICO Children’s Code, Online Safety Act |
| **US (federal)** | COPPA, CAN-SPAM, ADA, FTC Act, HIPAA (sector), Section 230 |
| **US (state)** | CCPA/CPRA and ~20 state privacy laws, BIPA, breach notification |
| **Global** | WCAG, PCI DSS, ISO 27001 (contractual), OECD principles |

---

## 19. When to Escalate to Lawyers

- Processing **health, biometric, or children’s** data at scale.
- **Automated decisions** affecting legal rights, health, or employment.
- **Cross-border transfers** to US, China, India, or other non-adequate countries.
- Product may be **medical device** or regulated financial advice.
- **Breach** or regulatory inquiry received.
- **Enterprise B2B** customers requiring DPAs, SOC 2, ISO 27001.
- Launching in **new countries** or running paid marketing to EU consumers.

---

*Last updated: June 2026 — regulatory landscape changes frequently; verify current thresholds and dates.*
