const canvasShim = {};

export default canvasShim;
export const createCanvas = () => {
  throw new Error("Canvas rendering is disabled for PDF text extraction.");
};