import { requireAuth, touchLastActive } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";

const CATEGORY_COLLECTIONS = ["customers", "invoices", "recurringInvoices"];

function normalizeCategory(value) {
  return String(value || "").trim();
}

function categoryQuery(ownerId, category) {
  if (category === "Uncategorized") {
    return {
      ownerId,
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: "" },
        { category: "Uncategorized" },
      ],
    };
  }

  return { ownerId, category };
}

async function updateCategoryAcrossCollections(db, ownerId, category, update) {
  const results = {};

  for (const collectionName of CATEGORY_COLLECTIONS) {
    const result = await db
      .collection(collectionName)
      .updateMany(categoryQuery(ownerId, category), update);

    results[collectionName] = result.modifiedCount;
  }

  return results;
}

export async function PATCH(req) {
  try {
    const userId = requireAuth(req);
    const body = await req.json();
    const currentCategory = normalizeCategory(body.currentCategory);
    const newCategory = normalizeCategory(body.newCategory);

    if (!currentCategory) {
      return Response.json({ error: "Current category is required" }, { status: 400 });
    }

    if (!newCategory) {
      return Response.json({ error: "New category is required" }, { status: 400 });
    }

    if (currentCategory === newCategory) {
      return Response.json({ success: true, unchanged: true });
    }

    const db = await connectDB();
    touchLastActive(db, userId);

    const updated = await updateCategoryAcrossCollections(
      db,
      userId,
      currentCategory,
      {
        $set: {
          category: newCategory,
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true, updated, category: newCategory });
  } catch (error) {
    console.error("RENAME CATEGORY ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to rename category" },
      { status }
    );
  }
}

export async function DELETE(req) {
  try {
    const userId = requireAuth(req);
    const body = await req.json();
    const category = normalizeCategory(body.category);

    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    const db = await connectDB();
    touchLastActive(db, userId);

    const updated = await updateCategoryAcrossCollections(db, userId, category, {
      $set: {
        category: "",
        updatedAt: new Date(),
      },
    });

    return Response.json({ success: true, updated });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to delete category" },
      { status }
    );
  }
}
