import { ADAPTERS } from "./adapters/index.js";
import { CliError, EXIT_USAGE } from "./model.js";

const COMMANDS = ["export", "import", "convert", "diff", "doctor", "clients", "completion"];
const CLIENT_OPTS: Record<string, string[]> = {
  export: ["-o", "--out", "--include-secrets", "--json"],
  import: ["-i", "--in", "--apply", "--replace-mcp", "--json"],
  convert: ["--apply", "--include-secrets", "--replace-mcp", "--json"],
  diff: ["--json"],
  doctor: ["--json"],
  clients: ["--json"],
  completion: [],
};
const CLIENT_ARG_COMMANDS = ["export", "import", "convert", "diff"];

/** Generate a shell completion script (enable with e.g. `eval "$(agentmove completion bash)"`). */
export function completionScript(shell: string): string {
  const clients = Object.keys(ADAPTERS).join(" ");
  const commands = COMMANDS.join(" ");
  const optCases = COMMANDS.map((c) => `${c}) opts="${CLIENT_OPTS[c]!.join(" ")}" ;;`).join(
    "\n            ",
  );
  const clientCases = CLIENT_ARG_COMMANDS.join("|");
  const body = `_agentmove() {
    local cur prev cmd opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    cmd="\${COMP_WORDS[1]}"
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${commands}" -- "$cur") )
        return 0
    fi
    case "$cmd" in
        ${clientCases})
            if [[ "$cur" != -* ]]; then
                COMPREPLY=( $(compgen -W "${clients}" -- "$cur") )
                return 0
            fi
            ;;
        completion)
            COMPREPLY=( $(compgen -W "bash zsh" -- "$cur") )
            return 0
            ;;
    esac
    case "$cmd" in
            ${optCases}
    esac
    COMPREPLY=( $(compgen -W "$opts --home" -- "$cur") )
    return 0
}
complete -F _agentmove agentmove
`;
  if (shell === "bash") return body;
  if (shell === "zsh") return `autoload -Uz +X bashcompinit && bashcompinit\n${body}`;
  throw new CliError(`unknown shell "${shell}" (expected bash or zsh)`, EXIT_USAGE);
}
