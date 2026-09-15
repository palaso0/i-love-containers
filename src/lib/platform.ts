export const isMac =
  typeof window !== "undefined" &&
  (navigator.platform?.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent?.toUpperCase().indexOf("MAC") >= 0);

export const isWindows =
  typeof window !== "undefined" &&
  (navigator.platform?.toUpperCase().indexOf("WIN") >= 0 ||
    navigator.userAgent?.toUpperCase().indexOf("WIN") >= 0);

export const isLinux =
  typeof window !== "undefined" &&
  !isMac &&
  !isWindows &&
  (navigator.platform?.toUpperCase().indexOf("LINUX") >= 0 ||
    navigator.userAgent?.toUpperCase().indexOf("LINUX") >= 0);

export const modKeySymbol = isMac ? "⌘" : "Ctrl";
export const modKeyName = isMac ? "Cmd" : "Ctrl";
