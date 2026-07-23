"use client";

import {
  clearOperatorTenantAction,
  switchOperatorTenantAction,
} from "@/lib/actions/operator";

type Props = {
  tenants: Array<{ id: string; name: string }>;
  activeOrgId: string | null;
};

export function OperatorSwitcher({ tenants, activeOrgId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <form action={switchOperatorTenantAction} className="flex items-center gap-2">
        <input type="hidden" name="return_to" value="/operator" />
        <label className="sr-only" htmlFor="operator-tenant">
          Active tenant
        </label>
        <select
          id="operator-tenant"
          name="org_id"
          defaultValue={activeOrgId ?? ""}
          className="max-w-[14rem] rounded-md border border-[var(--line)] bg-black/30 px-2 py-1.5 text-white"
          onChange={(e) => {
            if (e.target.value) e.currentTarget.form?.requestSubmit();
          }}
        >
          <option value="" disabled>
            Switch tenant…
          </option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </form>
      {activeOrgId ? (
        <form action={clearOperatorTenantAction}>
          <button
            type="submit"
            className="text-xs text-[var(--fog)] underline hover:text-white"
          >
            Clear
          </button>
        </form>
      ) : null}
    </div>
  );
}
