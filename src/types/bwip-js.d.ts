declare module "bwip-js" {
  export interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?:
      | "offleft"
      | "left"
      | "center"
      | "right"
      | "offright"
      | "justify";
    backgroundcolor?: string;
    barcolor?: string;
    textcolor?: string;
    paddingwidth?: number;
    paddingheight?: number;
    rotate?: "N" | "R" | "L" | "I";
  }

  interface BwipJsModule {
    toCanvas(
      canvas: HTMLCanvasElement | string,
      opts: RenderOptions,
    ): HTMLCanvasElement;
  }

  const bwipjs: BwipJsModule;
  export default bwipjs;
}
