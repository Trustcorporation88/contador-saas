/**
 * HelpCenter — componentes de ajuda contextual.
 *
 * - QuickTip: alerta inline curto (info/warning/success/error)
 * - InlineHelp: card explicativo persistente (com ações)
 * - InlineHelpCompact: versão de uma linha
 * - FAQ: accordion de perguntas frequentes
 */

export { QuickTip, type QuickTipProps } from './QuickTip';
export {
  InlineHelp,
  InlineHelpCompact,
  type InlineHelpProps,
  type InlineHelpAction,
} from './InlineHelp';
export { FAQ, type FAQProps, type FAQItem } from './FAQ';
