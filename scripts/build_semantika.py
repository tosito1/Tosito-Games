import os
import re

root_file = 'semantika.html'
pub_file = 'public/semantika.html'

with open(root_file, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove imports
code = re.sub(r"import React.*?;\n", "", code)
# Extract lucide imports to build list
lucide_match = re.search(r"import\s+\{(.*?)\}\s+from\s+'lucide-react';", code)
if lucide_match:
    icons = [i.strip() for i in lucide_match.group(1).split(',')]
else:
    icons = ["Target", "Trophy", "Send", "HelpCircle", "Share2", "Sparkles", "Zap", "BrainCircuit", "Activity", "Database", "CloudFog", "Cpu", "Orbit", "Terminal", "Crosshair", "Beaker", "Radar", "ShieldAlert", "FileJson", "User", "LogOut", "BarChart3", "RefreshCw"]
code = re.sub(r"import\s+\{.*?\}\s+from\s+'lucide-react';\n", "", code)
code = re.sub(r"import\s+\{.*?\}\s+from\s+'firebase/.*?';\n", "", code)

# 2. Replace icons
for icon in icons:
    # <Icon />
    code = re.sub(fr"<{icon}\s*/>", fr'<Icon name="{icon}" />', code)
    # <Icon className="..."/>
    code = re.sub(fr"<{icon}([^>]*?)/>", fr'<Icon name="{icon}"\1/>', code)
    # <Icon ...> ... </Icon> (if any)
    code = re.sub(fr"<{icon}([^>]*?)>(.*?)</{icon}>", fr'<Icon name="{icon}"\1>\2</Icon>', code)

# 3. Strip TS Types
# const [guesses, setGuesses] = useState<Guess[]>([]);
code = re.sub(r"<Guess\[\]>", "", code)
code = re.sub(r"<ProcessStatus>", "", code)
code = re.sub(r"<any>", "", code)
code = re.sub(r"<string\[\]>", "", code)
code = re.sub(r"<any\[\]>", "", code)
code = re.sub(r"<string>", "", code)
code = re.sub(r"<HTMLCanvasElement>", "", code)

# function params
code = code.replace("msg: string", "msg")
code = code.replace("wordInput: string", "wordInput")
code = code.replace("w1: string", "w1")
code = code.replace("w2: string", "w2")
code = code.replace("e: MouseEvent", "e")
code = code.replace("e: any", "e")
code = code.replace("type: 'free' | '50' | '100'", "type")
code = code.replace("g:any", "g")
code = code.replace("g: any", "g")

# Types and interfaces
code = re.sub(r"type ProcessStatus.*?\n", "", code)
code = re.sub(r"interface Guess \{.*?\n\n?", "", code)
code = re.sub(r": Record<string, string>", "", code)
code = re.sub(r"as Record<string, number>", "", code)
code = re.sub(r"as any", "", code)
code = re.sub(r"export default function App", "function App", code)

# specific functions with complex typings
code = re.sub(r"\{ text: string\|number, isNew: boolean, colorClass: string \}", "", code)
code = re.sub(r": \{ text, isNew, colorClass \}", "", code) # in case it matches wrong
code = re.sub(r": \{ guesses: Guess\[\], hasWon: boolean, isProcessing: boolean, isTyping: boolean, onFusion: \(w1:string, w2:string\)=>void, combo: number, energy: number, trigger: number \}", "", code)
code = re.sub(r": Promise<\{isValid: boolean, rank: number, source: ProcessStatus\}>", "", code)
code = re.sub(r"target: string, guess: string, currentUser: any, onStatusChange: \(s: ProcessStatus\) => void, log: \(s:string\)=>void", "target, guess, currentUser, onStatusChange, log", code)

# remove empty imports or lines left over
code = code.replace("// --- FIREBASE IMPORTS ---", "")

# 4. Read public/semantika.html header up to <script type="text/babel">
with open(pub_file, 'r', encoding='utf-8') as f:
    pub = f.read()

header = pub.split('const {useState,useEffect,useRef,useCallback,useMemo}=React;')[0] + 'const {useState,useEffect,useRef,useCallback,useMemo}=React;\n'

footer = "\nReactDOM.render(<App />, document.getElementById('root'));\n</script>\n</body>\n</html>"

icon_component = """
/* ─ ICON ─ */
const toKebab=s=>s.replace(/([A-Z])/g,m=>'-'+m.toLowerCase()).replace(/^-/,'');
const Icon=({name,size=20,className=""})=>{
  const r=useRef(null);
  useEffect(()=>{
    if(!window.lucide||!r.current)return;
    r.current.innerHTML=`<i data-lucide="${toKebab(name)}"></i>`;
    window.lucide.createIcons({el:r.current});
    const s=r.current.querySelector('svg');
    if(s){s.setAttribute('width',size);s.setAttribute('height',size);if(className)s.setAttribute('class',className);}
  },[name,size,className]);
  return <span ref={r} className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}/>;
};
"""

final_code = header + icon_component + code + footer

with open(pub_file, 'w', encoding='utf-8') as f:
    f.write(final_code)

print("Build successful!")
