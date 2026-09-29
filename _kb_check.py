import sqlite3

conn = sqlite3.connect(r"C:\Users\Leeway\Desktop\chatbot2\faq.db")
n = conn.execute(
    "SELECT COUNT(*) FROM knowledge_base WHERE source LIKE 'website:%'"
).fetchone()[0]
total = conn.execute("SELECT COUNT(*) FROM knowledge_base").fetchone()[0]
print("website rows:", n, "| total KB rows:", total)
for r in conn.execute(
    "SELECT id, substr(title,1,60), length(content), length(chunks_json) "
    "FROM knowledge_base WHERE source LIKE 'website:%' ORDER BY id LIMIT 8"
):
    print(r)
noemb = conn.execute(
    "SELECT COUNT(*) FROM knowledge_base WHERE source LIKE 'website:%' AND embedding_blob IS NULL"
).fetchone()[0]
print("website rows missing embeddings:", noemb)
conn.close()
