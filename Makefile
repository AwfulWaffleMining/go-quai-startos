# Server Pure and most StartOS hardware is x86_64. A Quai node wants 8+ cores,
# so aarch64 SBCs are not a target for now.
ARCHES := x86
# overrides to s9pk.mk must precede the include statement
include node_modules/@start9labs/start-sdk/s9pk.mk
