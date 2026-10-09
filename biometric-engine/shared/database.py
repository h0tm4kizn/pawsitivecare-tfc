"""
FILE: shared/database.py
PURPOSE: Shared SQLite helper functions used by both dog-noseprint and cat-facial-recog engines.
Stores production Siamese 128-dimensional embeddings with pet name support.
Legacy 1280-dimensional galleries are intentionally rejected by the production
service and must not be mixed with the Siamese gallery.
"""
import sqlite3
import numpy as np


def _migrate_name_column(cursor):
    """Add name column to existing tables that predate this field."""
    try:
        cursor.execute("ALTER TABLE pets ADD COLUMN name TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass  # Column already exists


def get_all_features(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    _migrate_name_column(cursor)
    conn.commit()
    cursor.execute("SELECT key, value, image_path, name FROM pets")
    rows = cursor.fetchall()
    conn.close()
    dataset = {}
    for row in rows:
        pet_name = (row[3] or '').strip()
        if not pet_name:
            continue
        dataset[row[0]] = {
            'features': np.frombuffer(row[1], dtype=np.float32).copy(),
            'image_path': row[2] or '',
            'name': pet_name,
        }
    return dataset


def insert_features(db_path, feature_array, image_path='', name=''):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS pets "
        "(key INTEGER, value BLOB, image_path TEXT, name TEXT)"
    )
    _migrate_name_column(cursor)
    conn.commit()

    pet_name = name.strip() if name else ''

    # Clean out old nameless test entries
    cursor.execute("DELETE FROM pets WHERE name IS NULL OR TRIM(name) = ''")
    conn.commit()

    if not pet_name:
        conn.close()
        return False

    # If pet_name exists, update embedding and image_path in place
    if pet_name:
        cursor.execute("SELECT key FROM pets WHERE UPPER(TRIM(name)) = ?", (pet_name.upper(),))
        row = cursor.fetchone()
        if row:
            key = row[0]
            cursor.execute(
                "UPDATE pets SET value = ?, image_path = ? WHERE key = ?",
                (sqlite3.Binary(feature_array.tobytes()), image_path, key),
            )
            conn.commit()
            conn.close()
            return True

    existing = get_all_features(db_path)
    new_id = max(existing.keys(), default=0) + 1
    cursor.execute(
        "INSERT INTO pets (key, value, image_path, name) VALUES (?, ?, ?, ?)",
        (new_id, sqlite3.Binary(feature_array.tobytes()), image_path, pet_name),
    )
    conn.commit()
    conn.close()
    return True


def init_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS pets "
        "(key INTEGER, value BLOB, image_path TEXT, name TEXT)"
    )
    _migrate_name_column(cursor)
    conn.commit()
    conn.close()
