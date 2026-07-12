// AI : app prefs for the shared JSON viewer — types live in @shared/json-viewer.

import { stringBrowserPref } from "@/lib/browser-storage-pref"
import {
  DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  isJsonViewerHumanViewId,
  isJsonViewerSyntaxThemeId,
} from "@shared/json-viewer/types"

export {
  DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  JSON_VIEWER_HUMAN_VIEWS,
  JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  JSON_VIEWER_SYNTAX_PREVIEW,
  JSON_VIEWER_SYNTAX_THEMES,
  isJsonViewerHumanViewId,
  isJsonViewerSyntaxThemeId,
  type JsonViewerHumanViewId,
  type JsonViewerSyntaxThemeId,
} from "@shared/json-viewer/types"

export { isJsonText } from "@shared/json-viewer/is-json-text"

const defaultViewPref = stringBrowserPref({
  keySuffix: "json-viewer-default-view",
  defaultValue: DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  changedEvent: JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  isValid: isJsonViewerHumanViewId,
})

export const JSON_VIEWER_DEFAULT_VIEW_KEY = defaultViewPref.key
export const readJsonViewerDefaultView = defaultViewPref.read
export const writeJsonViewerDefaultView = defaultViewPref.write

const syntaxThemePref = stringBrowserPref({
  keySuffix: "json-viewer-syntax-theme",
  defaultValue: DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  changedEvent: JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  isValid: isJsonViewerSyntaxThemeId,
})

export const JSON_VIEWER_SYNTAX_THEME_KEY = syntaxThemePref.key
export const readJsonViewerSyntaxTheme = syntaxThemePref.read
export const writeJsonViewerSyntaxTheme = syntaxThemePref.write
