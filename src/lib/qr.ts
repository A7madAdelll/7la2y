import "server-only";
import QRCode from "qrcode";

/** QR code as an SVG string (dark modules in our ink color). Used for posters, settings and TV. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#15202b", light: "#ffffff" } });
}
