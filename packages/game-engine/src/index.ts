export type EnginePlaceholder = {
  name: "foundation-placeholder-engine";
  supportedVariants: ["holdem"];
};

export function createEnginePlaceholder(): EnginePlaceholder {
  return {
    name: "foundation-placeholder-engine",
    supportedVariants: ["holdem"]
  };
}
