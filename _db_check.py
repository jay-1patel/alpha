import sqlite3

conn = sqlite3.connect(r"C:\Users\Leeway\Desktop\chatbot2\faq.db")
cur = conn.cursor()
print("faq_dataset sources:")
for row in cur.execute("SELECT source_file, module, COUNT(*) FROM faq_dataset GROUP BY source_file, module"):
    print("  ", row)
print("knowledge_base rows:")
for row in cur.execute("SELECT id, title, category, source FROM knowledge_base"):
    print("  ", row)
print("products:")
for row in cur.execute("SELECT id, name, category, price FROM products"):
    print("  ", row)
print("admin_files:")
for row in cur.execute("SELECT id, name, module FROM admin_files"):
    print("  ", row)
conn.close()
