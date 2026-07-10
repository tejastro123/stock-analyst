import os

def resolve_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return

    new_lines = []
    in_conflict = False
    in_ours = False
    in_theirs = False
    ours_lines = []
    modified = False

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<<'):
            in_conflict = True
            in_ours = True
            in_theirs = False
            ours_lines = []
            modified = True
            i += 1
            continue
        elif line.startswith('======='):
            in_ours = False
            in_theirs = True
            i += 1
            continue
        elif line.startswith('>>>>>>>'):
            in_conflict = False
            in_ours = False
            in_theirs = False
            new_lines.extend(ours_lines)
            i += 1
            continue

        if in_conflict:
            if in_ours:
                ours_lines.append(line)
        else:
            new_lines.append(line)
        i += 1

    if modified:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"Resolved conflicts in: {filepath}")
        except Exception as e:
            print(f"Error writing {filepath}: {e}")

def main():
    skip_dirs = {'.git', 'node_modules', '.venv', 'venv', 'dist', 'release'}
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in ('.js', '.jsx', '.py', '.json', '.css', '.html', '.md', '.ts', '.tsx'):
                filepath = os.path.join(root, file)
                resolve_file(filepath)

if __name__ == '__main__':
    main()
