import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Eye, Database, Users, Globe, Mail, FileText } from "lucide-react";

/**
 * Privacy Policy page for RoboMemo
 * Design: Clean, trust-focused layout inspired by Manus Trust and Scale AI trust pages
 * Dark theme consistent with main site, with structured sections and clear typography
 */

const sections = [
  {
    id: "overview",
    icon: <Shield className="w-5 h-5" />,
    title: "Overview",
    content: `RoboMemo ("we", "our", or "us") is committed to protecting the privacy and security of all data processed through the Web2Web3Claw platform. This Privacy Policy explains how we collect, use, store, and protect information when you interact with our embodied data collection and trading platform.

By using RoboMemo services, you agree to the practices described in this policy. We encourage you to read this document carefully and contact us if you have any questions.`,
  },
  {
    id: "data-collection",
    icon: <Database className="w-5 h-5" />,
    title: "Data We Collect",
    subsections: [
      {
        title: "Platform Usage Data",
        items: [
          "Interaction logs with the Web2Web3Claw pipeline interface",
          "Pipeline execution metadata (timestamps, processing stages, error logs)",
          "API request and response metadata (excluding payload content)",
          "Browser type, operating system, and device identifiers",
        ],
      },
      {
        title: "Embodied Data Assets",
        items: [
          "Video metadata sourced from public Web2 platforms (e.g., Bilibili, YouTube)",
          "Auto-generated annotation labels produced by our VLM pipeline",
          "Robot action trajectories and task completion records",
          "Blockchain transaction records for data asset registration and trading",
        ],
      },
      {
        title: "Account & Contact Information",
        items: [
          "Email address (e.g., when contacting robomemo.hello@gmail.com)",
          "GitHub account identifiers for repository access",
          "Wallet addresses for Web3 data trading transactions",
        ],
      },
    ],
  },
  {
    id: "data-use",
    icon: <Eye className="w-5 h-5" />,
    title: "How We Use Your Data",
    items: [
      "To operate and improve the Web2Web3Claw data pipeline and annotation engine",
      "To process and validate embodied data assets for VLA model training",
      "To facilitate transparent data trading through blockchain-based smart contracts",
      "To communicate with users regarding platform updates, security notices, and research outcomes",
      "To conduct academic research on embodied AI, robot learning, and data quality metrics",
      "To comply with applicable laws, regulations, and institutional research ethics requirements",
    ],
  },
  {
    id: "data-sharing",
    icon: <Users className="w-5 h-5" />,
    title: "Data Sharing & Third Parties",
    content: `RoboMemo does not sell personal data to third parties. We may share data in the following limited circumstances:`,
    items: [
      "**Research Collaborators**: Anonymized, aggregated datasets may be shared with academic institutions (e.g., HKU, Tsinghua University) for embodied AI research under data sharing agreements.",
      "**Blockchain Networks**: Data asset fingerprints and NAS link keys are recorded on-chain as part of the Web3 trading mechanism. This data is publicly verifiable by design.",
      "**NVIDIA Platform**: Compute usage metadata may be shared with NVIDIA when using GX10 Spark and related SDK services.",
      "**Legal Requirements**: We may disclose data when required by law, court order, or to protect the rights and safety of our users and the public.",
    ],
  },
  {
    id: "data-security",
    icon: <Lock className="w-5 h-5" />,
    title: "Data Security",
    content: `We implement industry-standard security measures to protect your data:`,
    items: [
      "All data in transit is encrypted using TLS 1.3 or higher",
      "Data at rest is encrypted using AES-256 on NAS storage systems",
      "Web3 data keys are managed through cryptographic key management protocols",
      "Access to production systems is restricted to authorized team members with multi-factor authentication",
      "Regular security audits and penetration testing are conducted on our pipeline infrastructure",
      "Blockchain-based immutability ensures data provenance and audit trails cannot be tampered with",
    ],
  },
  {
    id: "blockchain",
    icon: <Globe className="w-5 h-5" />,
    title: "Blockchain & Web3 Considerations",
    content: `The RoboMemo platform uses blockchain technology for data asset registration and trading. Users should be aware of the following:`,
    items: [
      "Transactions recorded on-chain are permanent and publicly visible — this is a fundamental property of blockchain technology.",
      "Wallet addresses used for data trading may be associated with your identity if you publicly link them.",
      "Smart contract interactions are governed by the contract code deployed on-chain; RoboMemo cannot reverse or modify completed transactions.",
      "NAS storage links and encrypted keys uploaded to the blockchain are accessible to parties who hold the corresponding decryption credentials.",
    ],
  },
  {
    id: "retention",
    icon: <FileText className="w-5 h-5" />,
    title: "Data Retention",
    content: `We retain data for as long as necessary to fulfill the purposes outlined in this policy:`,
    items: [
      "Platform usage logs: retained for 90 days, then anonymized or deleted",
      "Annotation datasets and robot trajectories: retained for the duration of the research project",
      "Blockchain records: permanently stored on-chain as per the nature of the technology",
      "Contact information: retained until you request deletion or withdraw consent",
      "You may request deletion of your personal data at any time by contacting robomemo.hello@gmail.com",
    ],
  },
  {
    id: "rights",
    icon: <Users className="w-5 h-5" />,
    title: "Your Rights",
    content: `Depending on your jurisdiction, you may have the following rights regarding your personal data:`,
    items: [
      "**Right to Access**: Request a copy of the personal data we hold about you",
      "**Right to Rectification**: Request correction of inaccurate or incomplete data",
      "**Right to Erasure**: Request deletion of your personal data (subject to legal and blockchain limitations)",
      "**Right to Portability**: Receive your data in a structured, machine-readable format",
      "**Right to Object**: Object to processing of your data for certain purposes",
      "**Right to Withdraw Consent**: Withdraw consent at any time without affecting prior processing",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between py-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/robomemologonobackground_dcc38179.png"
                alt="RoboMemo Logo"
                className="w-8 h-8 object-contain"
              />
              <span className="text-lg font-bold">RoboMemo</span>
            </div>
          </Link>
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 border-b border-border bg-gradient-to-b from-slate-950/40 to-background">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-sm text-cyan-400 font-medium uppercase tracking-widest">Privacy & Trust</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
            RoboMemo is committed to transparency in how we handle data across our embodied AI data collection and Web3 trading platform.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Effective Date: April 9, 2026
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Last Updated: April 9, 2026
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Version 1.0
            </span>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-10 border-b border-border bg-slate-950/20">
        <div className="container max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Lock className="w-5 h-5" />, label: "AES-256 Encryption" },
              { icon: <Shield className="w-5 h-5" />, label: "No Data Selling" },
              { icon: <Globe className="w-5 h-5" />, label: "Blockchain Transparency" },
              { icon: <Mail className="w-5 h-5" />, label: "GDPR Aligned" },
            ].map((badge, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 bg-slate-900/30 text-center"
              >
                <div className="text-cyan-400">{badge.icon}</div>
                <span className="text-xs font-medium">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8 border-b border-border">
        <div className="container max-w-4xl">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Table of Contents</h2>
          <nav className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {sections.map((s, idx) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition py-1"
              >
                <span className="text-cyan-500/60 font-mono text-xs">{String(idx + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Main Content */}
      <main className="py-12">
        <div className="container max-w-4xl space-y-16">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold">{section.title}</h2>
              </div>

              {section.content && (
                <p className="text-muted-foreground leading-relaxed mb-4">{section.content}</p>
              )}

              {section.subsections && (
                <div className="space-y-6">
                  {section.subsections.map((sub, idx) => (
                    <div key={idx} className="pl-4 border-l-2 border-cyan-500/30">
                      <h3 className="font-semibold mb-3 text-foreground">{sub.title}</h3>
                      <ul className="space-y-2">
                        {sub.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-cyan-400 mt-0.5 shrink-0">›</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {section.items && (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-cyan-400 mt-0.5 shrink-0">›</span>
                      <span dangerouslySetInnerHTML={{
                        __html: item.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                      }} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* Contact Section */}
          <section id="contact" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold">Contact Us</h2>
            </div>
            <div className="p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, wish to exercise your data rights, or have concerns about how we handle your information, please contact us:
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <a
                    href="mailto:robomemo.hello@gmail.com"
                    className="text-cyan-400 hover:text-cyan-300 transition font-medium"
                  >
                    robomemo.hello@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <a
                    href="https://github.com/RoboMemo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition font-medium"
                  >
                    github.com/RoboMemo
                  </a>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                We aim to respond to all privacy-related inquiries within 5 business days.
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section className="p-6 rounded-xl border border-border bg-slate-900/30">
            <h3 className="font-semibold mb-2">Changes to This Policy</h3>
            <p className="text-sm text-muted-foreground">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will notify users of material changes by posting the updated policy on this page with a revised effective date. Continued use of the RoboMemo platform after such changes constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-slate-950/50 py-8 mt-12">
        <div className="container max-w-4xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/robomemologonobackground_dcc38179.png"
              alt="RoboMemo"
              className="w-5 h-5 object-contain"
            />
            <span className="text-sm font-semibold">RoboMemo</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 RoboMemo. All rights reserved.</p>
          <Link href="/">
            <span className="text-sm text-cyan-400 hover:text-cyan-300 transition cursor-pointer">← Back to Home</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
