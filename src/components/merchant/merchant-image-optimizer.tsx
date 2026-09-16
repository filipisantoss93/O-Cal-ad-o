"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const OPTIMIZED_FIELDS = new Set(["image", "logo", "cover"]);
const OPTIMIZED_PATHS = new Set([
  "/painel/catalogo",
  "/painel/promocoes",
  "/painel/loja",
  "/painel/admin/pre-cadastros",
]);
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const TARGET_BYTES = 900 * 1024;
const MAX_OUTPUT_BYTES = 1300 * 1024;
const DIMENSIONS = [1600, 1440, 1280, 1080];
const QUALITIES = [0.82, 0.74, 0.66, 0.58];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler esta imagem."));
    };
    image.src = url;
  });
}

function canvasFor(image: HTMLImageElement, maxDimension: number) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Seu navegador não conseguiu converter a imagem para WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function optimizeImage(source: File) {
  if (!ALLOWED_TYPES.has(source.type)) {
    throw new Error("Use uma foto JPG, PNG, WebP ou AVIF.");
  }
  if (source.size > MAX_SOURCE_BYTES) {
    throw new Error("A foto original pode ter no máximo 20 MB.");
  }

  const image = await loadImage(source);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("A imagem selecionada é inválida.");
  }

  let smallest: Blob | null = null;
  for (const dimension of DIMENSIONS) {
    const canvas = canvasFor(image, dimension);
    for (const quality of QUALITIES) {
      const blob = await canvasToWebp(canvas, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= TARGET_BYTES) {
        const baseName = source.name.replace(/\.[^.]+$/, "") || "imagem";
        return new File([blob], `${baseName}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }
    }
  }

  if (!smallest || smallest.size > MAX_OUTPUT_BYTES) {
    throw new Error("A foto ficou grande demais mesmo após a otimização. Escolha outra imagem.");
  }

  const baseName = source.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([smallest], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function statusElement(input: HTMLInputElement) {
  const existing = input.parentElement?.querySelector<HTMLElement>(
    "[data-image-optimizer-status]",
  );
  if (existing) return existing;
  const status = document.createElement("span");
  status.dataset.imageOptimizerStatus = "true";
  status.className = "mt-1.5 block text-xs font-semibold text-muted";
  status.setAttribute("role", "status");
  input.insertAdjacentElement("afterend", status);
  return status;
}

function setStatus(input: HTMLInputElement, message: string, error = false) {
  const status = statusElement(input);
  status.textContent = message;
  status.className = error
    ? "mt-1.5 block text-xs font-bold text-brand-dark"
    : "mt-1.5 block text-xs font-semibold text-muted";
}

function setFormOptimizing(form: HTMLFormElement | null, optimizing: boolean) {
  if (!form) return;
  const currentCount = Number(form.dataset.imageOptimizingCount ?? "0");
  const nextCount = optimizing
    ? currentCount + 1
    : Math.max(0, currentCount - 1);
  form.dataset.imageOptimizingCount = String(nextCount);
  form.dataset.imageOptimizing = nextCount > 0 ? "true" : "false";

  const controls = form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    'button[type="submit"], input[type="submit"]',
  );
  controls.forEach((control) => {
    if (nextCount > 0) {
      if (!control.dataset.imageOptimizerWasDisabled) {
        control.dataset.imageOptimizerWasDisabled = control.disabled ? "true" : "false";
      }
      control.disabled = true;
      return;
    }
    if (control.dataset.imageOptimizerWasDisabled !== "true") control.disabled = false;
    delete control.dataset.imageOptimizerWasDisabled;
  });
}

async function optimizeInput(input: HTMLInputElement, source: File) {
  const form = input.form;
  setFormOptimizing(form, true);
  setStatus(input, `Otimizando ${formatBytes(source.size)} antes do envio...`);

  try {
    const optimized = await optimizeImage(source);
    if (typeof DataTransfer === "undefined") {
      throw new Error("Seu navegador não permite substituir a foto otimizada.");
    }
    const transfer = new DataTransfer();
    transfer.items.add(optimized);
    input.files = transfer.files;
    const reduction = source.size > 0
      ? Math.max(0, Math.round((1 - optimized.size / source.size) * 100))
      : 0;
    setStatus(
      input,
      `Foto pronta: ${formatBytes(optimized.size)} em WebP${reduction > 0 ? ` · ${reduction}% menor` : ""}.`,
    );
  } catch (error) {
    input.value = "";
    setStatus(
      input,
      error instanceof Error ? error.message : "Não foi possível otimizar a foto.",
      true,
    );
  } finally {
    setFormOptimizing(form, false);
  }
}

export function MerchantImageOptimizer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!OPTIMIZED_PATHS.has(pathname)) return;

    const onChange = (event: Event) => {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        input.type !== "file" ||
        !OPTIMIZED_FIELDS.has(input.name)
      ) return;
      const source = input.files?.[0];
      if (!source) return;
      void optimizeInput(input, source);
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.imageOptimizing !== "true") return;
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>(
        'input[type="file"][name="image"], input[type="file"][name="logo"], input[type="file"][name="cover"]',
      );
      if (input) {
        setStatus(
          input,
          "Aguarde a otimização das fotos terminar antes de salvar.",
          true,
        );
      }
    };

    document.addEventListener("change", onChange, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [pathname]);

  return null;
}
