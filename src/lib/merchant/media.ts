import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const MEDIA_BUCKET = "business-media";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_ITEM_IMAGE_SIZE = 1536 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function imageFromForm(formData: FormData, field: string) {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  if (!IMAGE_EXTENSIONS[value.type]) {
    throw new Error("Envie uma imagem JPG, PNG, WebP ou AVIF.");
  }
  const maxSize = field === "image" ? MAX_ITEM_IMAGE_SIZE : MAX_IMAGE_SIZE;
  if (value.size > maxSize) {
    throw new Error(
      field === "image"
        ? "A imagem otimizada pode ter no máximo 1,5 MB."
        : "A imagem pode ter no máximo 5 MB.",
    );
  }
  return value;
}

export async function uploadMerchantImage(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File,
  purpose: "logo" | "cover" | "promotion" | "banner" | "catalog" | "event",
) {
  const extension = IMAGE_EXTENSIONS[file.type];
  const path = `${userId}/${purpose}-${crypto.randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error("Não foi possível enviar a imagem. Tente novamente.");
  }
  return path;
}

export async function removeMerchantImages(
  supabase: SupabaseClient<Database>,
  userId: string,
  paths: Array<string | null | undefined>,
) {
  const ownedPaths = paths.filter(
    (path): path is string => Boolean(path?.startsWith(`${userId}/`)),
  );
  if (ownedPaths.length === 0) {
    return { ok: true as const, removed: 0 };
  }

  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(ownedPaths);
    if (error) {
      console.error("Falha ao excluir imagem antiga do Storage", {
        bucket: MEDIA_BUCKET,
        paths: ownedPaths,
        error: error.message,
      });
      return {
        ok: false as const,
        removed: 0,
        error: error.message,
      };
    }

    return { ok: true as const, removed: ownedPaths.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erro inesperado ao excluir imagem antiga do Storage", {
      bucket: MEDIA_BUCKET,
      paths: ownedPaths,
      error: message,
    });
    return {
      ok: false as const,
      removed: 0,
      error: message,
    };
  }
}

export function publicMediaUrl(
  supabase: SupabaseClient<Database>,
  path: string | null,
) {
  if (!path) return null;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
