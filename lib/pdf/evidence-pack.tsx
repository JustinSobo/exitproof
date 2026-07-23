import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  computeCoverage,
  filterItemsByFramework,
  filterRefsByFramework,
  getFramework,
  resolveControlRefs,
  type ExportFrameworkFilter,
} from "@/lib/compliance";
import type {
  AuditEvent,
  ChecklistItem,
  EvidenceFile,
  OffboardingCase,
  Organization,
} from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0B1F2A",
  },
  brand: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0B1F2A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#3D5A68",
    marginBottom: 20,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#0F766E",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 120,
    color: "#3D5A68",
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: "#D6E2E8",
    paddingVertical: 8,
  },
  itemTitle: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  meta: {
    color: "#3D5A68",
    fontSize: 9,
  },
  disclaimer: {
    color: "#6B8794",
    fontSize: 8,
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#6B8794",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export type EvidencePackProps = {
  org: Organization;
  offboardingCase: OffboardingCase;
  items: ChecklistItem[];
  evidence: EvidenceFile[];
  audits: AuditEvent[];
  generatedAt: string;
  framework?: ExportFrameworkFilter;
};

export function EvidencePackDocument({
  org,
  offboardingCase,
  items,
  evidence,
  audits,
  generatedAt,
  framework = "all",
}: EvidencePackProps) {
  const filteredItems = filterItemsByFramework(items, framework);
  const coverage = computeCoverage({ items, evidence, framework });
  const done = filteredItems.filter((i) => i.status === "done").length;
  const fwLabel =
    framework === "all"
      ? "All frameworks"
      : (getFramework(framework)?.name ?? framework);
  const selectedFw = org.selected_frameworks ?? [];
  const selected = selectedFw.length > 0 ? selectedFw.join(", ") : "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>ExitProof</Text>
        <Text style={styles.subtitle}>
          Evidence Pack — audit-ready IT offboarding record ({fwLabel})
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Case summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Organization</Text>
            <Text style={styles.value}>{org.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Employee</Text>
            <Text style={styles.value}>
              {offboardingCase.employee_name} ({offboardingCase.employee_email})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{offboardingCase.status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Template</Text>
            <Text style={styles.value}>{offboardingCase.template_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Org frameworks</Text>
            <Text style={styles.value}>{selected}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pack view</Text>
            <Text style={styles.value}>{fwLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Window</Text>
            <Text style={styles.value}>
              {offboardingCase.created_at}
              {offboardingCase.closed_at
                ? ` → ${offboardingCase.closed_at}`
                : " → open"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Progress</Text>
            <Text style={styles.value}>
              {done} / {filteredItems.length} steps in view
            </Text>
          </View>
          <Text style={styles.disclaimer}>
            Supports evidence for listed controls — does not guarantee
            certification or FedRAMP authorization of ExitProof as a CSP.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Control coverage matrix</Text>
          {coverage.rows.length === 0 ? (
            <Text style={styles.meta}>No controls in this view.</Text>
          ) : (
            coverage.rows.map((row) => (
              <Text key={row.control.key} style={styles.meta}>
                [{row.status.toUpperCase()}] {row.control.framework}{" "}
                {row.control.controlId} — {row.control.title} ·{" "}
                {row.doneCount}/{row.totalItems} steps · {row.evidenceCount}{" "}
                evidence file(s)
              </Text>
            ))
          )}
          <Text style={styles.meta}>
            Summary: {coverage.covered} covered · {coverage.partial} partial ·{" "}
            {coverage.open} open ({coverage.total} controls)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Checklist</Text>
          {filteredItems.map((item) => {
            const refs = filterRefsByFramework(
              item.control_refs ?? [],
              framework,
            );
            const labels = resolveControlRefs(refs)
              .map((c) => c.controlId)
              .join(", ");
            const files = evidence.filter(
              (e) => e.checklist_item_id === item.id,
            );
            return (
              <View key={item.id} style={styles.item} wrap={false}>
                <Text style={styles.itemTitle}>
                  [{item.status.toUpperCase()}] {item.title}
                  {item.is_critical ? " ★ CRITICAL" : ""}
                  {item.requires_evidence ? " · evidence required" : ""}
                </Text>
                <Text style={styles.meta}>{item.description}</Text>
                {labels ? (
                  <Text style={styles.meta}>Controls: {labels}</Text>
                ) : null}
                {item.evidence_hint ? (
                  <Text style={styles.meta}>
                    Evidence hint: {item.evidence_hint}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text style={styles.meta}>Notes: {item.notes}</Text>
                ) : null}
                {item.ticket_url ? (
                  <Text style={styles.meta}>Ticket: {item.ticket_url}</Text>
                ) : null}
                {files.map((f) => (
                  <Text key={f.id} style={styles.meta}>
                    Evidence: {f.file_name}
                    {f.content_hash ? ` · SHA-256 ${f.content_hash}` : ""}
                  </Text>
                ))}
                {item.completed_at ? (
                  <Text style={styles.meta}>
                    Completed {item.completed_at} by {item.completed_by}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Evidence attachments</Text>
          {evidence.length === 0 ? (
            <Text style={styles.meta}>No evidence files attached.</Text>
          ) : (
            evidence.map((e) => (
              <Text key={e.id} style={styles.meta}>
                • {e.file_name}
                {e.content_hash ? ` · ${e.content_hash}` : ""}
                {e.mime_type ? ` · ${e.mime_type}` : ""}
                {e.byte_size != null ? ` · ${e.byte_size} B` : ""} — uploaded{" "}
                {e.created_at} by {e.uploaded_by}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Audit events (append-only)</Text>
          {audits.map((a) => (
            <Text key={a.id} style={styles.meta}>
              {a.created_at} · {a.event_type} · {a.actor_email || "system"}
            </Text>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Generated {generatedAt} · ExitProof Evidence Pack</Text>
          <Text>
            Retention policy: {org.retention_days} days · Plan: {org.plan}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
