import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawn, execFileSync } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron"
import { chromium } from "playwright-core"

const out = resolve("demo-evidence")
await mkdir(out, { recursive: true })
const dir = await mkdtemp(join(tmpdir(), "spaceship-demo-"))
const user = join(dir, "profile")
const extensions = join(dir, "extensions")
await mkdir(join(user, "User"), { recursive: true })
await mkdir(extensions)
const source = join(dir, "harbor-notes.md")
const synthetic = "# Harbor Notes\n\nAt dawn, Ada reached the quiet harbor and checked the signal book.\n"
await writeFile(source, synthetic)
await writeFile(join(user, "User/settings.json"), JSON.stringify({
  "window.newWindowDimensions": "maximized",
  "window.titleBarStyle": "custom",
  "workbench.colorTheme": "Default Light Modern",
  "workbench.startupEditor": "none",
  "workbench.activityBar.location": "hidden",
  "workbench.tips.enabled": false,
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoCheckUpdates": false,
  "extensions.autoUpdate": false,
  "editor.fontSize": 17,
  "editor.wordWrap": "on",
  "security.workspace.trust.enabled": false,
}))
const [vsixName, ...extra] = (await readdir("extension")).filter(x=>x.endsWith(".vsix"))
assert(vsixName && !extra.length && vsixName.endsWith("-0.3.0.vsix"))
const vsix = resolve("extension", vsixName)
const sha256 = createHash("sha256").update(await readFile(vsix)).digest("hex")
const executable = await downloadAndUnzipVSCode("1.105.1")
const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true })
const profile = ["--user-data-dir", user, "--extensions-dir", extensions]
execFileSync(cli, [...cliArgs,...profile,"--install-extension",vsix], {stdio:"inherit"})
const app = spawn(executable, [...profile,"--no-sandbox","--disable-gpu","--skip-welcome","--skip-release-notes","--remote-debugging-address=127.0.0.1","--remote-debugging-port=9229",source], {stdio:"inherit"})
const sleep = ms=>new Promise(r=>setTimeout(r,ms))
let browser, recorder, page
const segments=[]
const capture = async (name, caption, work) => {
  const path = join(dir, name+".mp4")
  recorder = spawn("ffmpeg", ["-hide_banner","-loglevel","error","-f","x11grab","-framerate","20","-video_size","1440x960","-i",process.env.DISPLAY,
    "-vf", `scale=1440:960,drawbox=x=0:y=0:w=iw:h=44:color=0x142537:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${join(dir,name+".txt")}:fontsize=21:fontcolor=white:x=22:y=11`,
    "-an","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-y",path], {stdio:["pipe","inherit","inherit"]})
  const recorded = once(recorder,"exit")
  try { await sleep(450); await work(); await sleep(2400) }
  finally { if(recorder.exitCode===null) recorder.stdin.write("q\n"); const [code]=await recorded; assert.equal(code,0); recorder=undefined }
  segments.push(path)
  await page.screenshot({path:join(out,name+".png")})
}
const stage=async(name,caption,work)=>{
  await writeFile(join(dir,name+".txt"),caption)
  await capture(name,caption,work)
}
try {
  for(let i=0;i<40 && !browser;i++){
    try { const ready=await fetch("http://127.0.0.1:9229/json/version"); if(ready.ok) browser=await chromium.connectOverCDP("http://127.0.0.1:9229") } catch {}
    if(!browser) await sleep(500)
  }
  assert(browser,"Could not connect to local isolated VS Code instance")
  for(let i=0;i<30 && !page;i++){
    page=browser.contexts()[0].pages().find(p=>p.url().includes("workbench"))
    if(!page) await sleep(400)
  }
  assert(page,"No VS Code workbench page")
  page.setDefaultTimeout(5000)
  await page.locator(".monaco-workbench").waitFor({timeout:20000})
  const cmd=async(name)=>{
    await page.keyboard.press("Control+Shift+p")
    const q=page.locator(".quick-input-widget input")
    await q.fill(">"+name)
    await sleep(450)
    await q.press("Enter")
  }
  // VS Code's editor wraps the real webview in an outer iframe. Find the
  // interactive inner document by its production control, not by a mock bridge.
  const inFrame=async(selector)=>{
    for(let i=0;i<50;i++){
      for(const f of page.frames()) if(await f.locator(selector).count().catch(()=>0)) return f
      await sleep(200)
    }
    throw Error("Real webview control not found: "+selector)
  }
  try{
    await cmd("Spaceship: Open Writing Desk")
    const desk=await inFrame("#add-knob")
    await stage("01-writing","VS Code on Linux  |  Writing Desk  |  Simulation uses canned text",async()=>{
      await desk.getByRole("button",{name:"Add Dimension",exact:true}).click()
      await sleep(3500)
    })
  }catch(e){ console.warn("Optional Writing Desk clip omitted:",e.message) }
  await cmd("View: Close All Editors")
  await cmd("Spaceship: Open Backbone Workbench")
  const w=await inFrame("#outline")
  const blocks=w.locator("#outline details")
  const add=w.getByRole("button",{name:"Add block",exact:true})
  const check=w.getByRole("button",{name:"Run outline check",exact:true})
  const field=async(i,key,value)=>blocks.nth(i).locator(`[data-field="${key}"]`).fill(value)
  await stage("02-outline","Backbone Workbench  |  Sketch two chapters without generating prose",async()=>{
    await w.locator("#title").fill("Harbor Notes")
    await add.click()
    await field(0,"name","Chapter 1: At the harbor")
    await field(0,"purpose","Establish Ada’s search")
    await field(0,"changes","The reader knows why Ada came")
    await blocks.nth(0).locator("summary").click()
    await add.click()
    await field(1,"name","Chapter 2: The crossing")
    await field(1,"purpose","Explain how Ada chooses a route")
    await field(1,"changes","Ada can choose a route")
    await blocks.nth(1).locator("summary").click()
    const summary=await blocks.nth(0).locator("summary").innerText()
    const id=summary.split(" · ").at(-1)
    assert(id.startsWith("block-"))
    await blocks.nth(1).locator("summary").click()
    await field(1,"dependsOn",id)
    await field(1,"needs","harbor log")
    await blocks.nth(1).locator("summary").click()
  })
  await stage("03-check","Run an outline check  |  Chapter 2 needs an earlier harbor log",async()=>{
    await check.click()
    await w.getByText(/Missing earlier output: harbor log/).waitFor()
    await sleep(3200)
  })
  await stage("04-repair","Fix the first chapter’s output, then recheck",async()=>{
    await blocks.nth(0).locator("summary").click()
    await field(0,"produces","harbor log")
    await blocks.nth(0).locator("summary").click()
    await check.click()
    await w.getByText(/Structural checks passed/).waitFor()
    await sleep(3200)
  })
  await stage("05-export","Export a separate Markdown copy  |  The original draft is unchanged",async()=>{
    await w.getByRole("button",{name:"Export Markdown copy",exact:true}).click()
    await page.locator(".tab").filter({hasText:/Untitled/}).first().waitFor()
    await sleep(3500)
  })
  assert.equal(await readFile(source,"utf8"),synthetic)
  await writeFile(join(dir,"clips.txt"),segments.map(path=>"file '"+path+"'").join("\n")+"\n")
  const mp4=join(out,"spaceship-writer-0.3.0-linux.mp4")
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",join(dir,"clips.txt"),"-c","copy","-movflags","+faststart","-y",mp4])
  const duration=Number(execFileSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",mp4],{encoding:"utf8"}))
  assert(duration>10 && duration<=60,`Unexpected video duration: ${duration}`)
  await writeFile(join(out,"recording.json"),JSON.stringify({application:"VS Code 1.105.1",os:"Linux / GitHub Actions",extension:"Spaceship Writer 0.3.0",vsix:vsixName,sha256,duration,stages:segments.map(p=>p.split("/").at(-1)),sourceUnchanged:true},null,2)+"\n")
} catch(e){
  if(page) await page.screenshot({path:join(out,"failure.png")}).catch(()=>{})
  throw e
} finally {
  if(recorder?.exitCode===null) recorder.kill()
  app.kill()
  await sleep(500)
  await rm(dir,{recursive:true,force:true})
}
