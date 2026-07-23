import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
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
};

export function EvidencePackDocument({
  org,
  offboardingCase,
  items,
  evidence,
  audits,
  generatedAt,
}: EvidencePackProps) {
  const done = items.filter((i) => i.status === "done").length;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>ExitProof</Text>
        <Text style={styles.subtitle}>
          Evidence Pack — audit-ready IT offboarding record
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
            <Text style={styles.label}>Due date</Text>
            <Text style={styles.value}>
              {offboardingCase.due_date || "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Progress</Text>
            <Text style={styles.value}>
              {done} / {items.length} steps complete
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Checklist</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.item} wrap={false}>
              <Text style={styles.itemTitle}>
                [{item.status.toUpperCase()}] {item.title}
                {item.is_critical ? " ★ CRITICAL" : ""}
                {item.requires_evidence ? " · evidence required" : ""}
              </Text>
              <Text style={styles.meta}>{item.description}</Text>
              {item.notes ? (
                <Text style={styles.meta}>Notes: {item.notes}</Text>
              ) : null}
              {item.ticket_url ? (
                <Text style={styles.meta}>Ticket: {item.ticket_url}</Text>
              ) : null}
              {item.completed_at ? (
                <Text style={styles.meta}>
                  Completed {item.completed_at} by {item.completed_by}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Evidence attachments</Text>
          {evidence.length === 0 ? (
            <Text style={styles.meta}>No evidence files attached.</Text>
          ) : (
            evidence.map((e) => (
              <Text key={e.id} style={styles.meta}>
                • {e.file_name} (item {e.checklist_item_id.slice(0, 8)}…) —
                uploaded {e.created_at} by {e.uploaded_by}
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
