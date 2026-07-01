// Admin server actions, split into focused "use server" domains under ./admin-actions/.
// This barrel preserves the public import path (@/lib/admin-actions) so every existing
// call site stays unchanged.
export * from "./admin-actions/produtos"
export * from "./admin-actions/entregadores"
export * from "./admin-actions/documentos"
export * from "./admin-actions/configuracoes"
export * from "./admin-actions/pedido-status"
export * from "./admin-actions/pedido-edit"
