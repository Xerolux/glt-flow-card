export function sharedProjectDocument(project, restore = false) {
  const result = structuredClone(project);
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (restore && node.runtime_entity_binding && node.runtime_entity_binding.entity === node.entity) {
      node.entity = node.runtime_entity_binding;
      delete node.runtime_entity_binding;
    } else if (!restore && node.entity && typeof node.entity === "object" && typeof node.entity.entity === "string") {
      if (node.runtime_entity_binding) throw new Error("Conflicting entity binding metadata");
      node.runtime_entity_binding = node.entity;
      node.entity = node.entity.entity;
    }
    for (const [key, value] of Object.entries(node)) if (key !== "runtime_entity_binding" && key !== "entity") visit(value);
  };
  visit(result);
  if (restore && result?.config?.project && Number.isInteger(result.revision)) {
    result.config.project.revision = result.revision;
  }
  return result;
}

export async function saveSharedProject(hass, project, { create = false } = {}) {
  project = sharedProjectDocument(project);
  const call = (route, payload) => hass.callWS({ type: `glt_flow_card/${route}`, ...payload });
  if (create) return call("projects/create", { project });
  const lease = await call("leases/acquire", { project_id: project.id, purpose: "engineering", ttl_seconds: 60 });
  try {
    return await call("projects/save", { project, expected_revision: Number(project.config?.project?.revision || 0), lease_token: lease.lease_token });
  } finally {
    await call("leases/release", { project_id: project.id, lease_token: lease.lease_token });
  }
}
