import type { ChannelPlugin } from "godseye/plugin-sdk/channel-core";
import { createLazyRuntimeNamedExport } from "godseye/plugin-sdk/lazy-runtime";
import type { ResolvedMatrixAccount } from "./matrix/accounts.js";

const loadMatrixChannelRuntime = createLazyRuntimeNamedExport(
  () => import("./channel.runtime.js"),
  "matrixChannelRuntime",
);

type MatrixResolver = NonNullable<ChannelPlugin<ResolvedMatrixAccount>["resolver"]>;

export const matrixResolverAdapter: MatrixResolver = {
  resolveTargets: async ({ cfg, accountId, inputs, kind, runtime }) =>
    (await loadMatrixChannelRuntime()).resolveMatrixTargets({
      cfg,
      accountId,
      inputs,
      kind,
      runtime,
    }),
};
