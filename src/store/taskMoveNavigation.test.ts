import {afterEach,describe,expect,it,vi} from "vitest";
import Dexie from "dexie";
import {db} from "../db";
import {useTodoStore} from "./todoStore";
import type {TaskRecord} from "../types";
const root: TaskRecord = {id:"root",listId:"source",title:"Task",note:"",priority:"none",scheduledDate:null,dueDate:null,completedAt:null,tags:[],parentId:null,sortOrder:0,repeatRule:null,createdAt:1,updatedAt:1,deletedAt:null};
afterEach(()=>{vi.restoreAllMocks();useTodoStore.setState({selectedListId:null,selectedTaskId:null,tasks:[],checkedIds:[]})});
function mockData() {
  const records=new Map([root, {...root,id:"child",parentId:"root"}, {...root,id:"target-root",listId:"target"}].map(t=>[t.id,t]));
  vi.spyOn(db.tasks,"toArray").mockImplementation(()=>Dexie.Promise.resolve([...records.values()]));
  vi.spyOn(db.tasks,"get").mockImplementation(id=>Dexie.Promise.resolve(records.get(id as unknown as string)));
  vi.spyOn(db.tasks,"put").mockImplementation(record=>{records.set(record.id!,record as TaskRecord);return Dexie.Promise.resolve(record.id!)});
  vi.spyOn(db,"transaction").mockImplementation((...args)=>Dexie.Promise.resolve((args[args.length-1] as ()=>Promise<void>)()));
  return records;
}
describe("quick list changes do not open task editor",()=>{
  it("moves root and children while preserving all-task scope and a closed editor",async()=>{
    const records=mockData();useTodoStore.setState({view:"list",selectedListId:null,selectedTaskId:null});
    await useTodoStore.getState().updateTask("root",{listId:"target"});
    expect(records.get("root")?.listId).toBe("target");expect(records.get("child")?.listId).toBe("target");
    expect(useTodoStore.getState().selectedTaskId).toBeNull();expect(useTodoStore.getState().selectedListId).toBeNull();
  });
  it("keeps a single-list filter and preserves details only if already open",async()=>{
    mockData();useTodoStore.setState({view:"list",selectedListId:"source",selectedTaskId:"root"});
    await useTodoStore.getState().updateTask("root",{listId:"target"});
    expect(useTodoStore.getState().selectedListId).toBe("source");expect(useTodoStore.getState().selectedTaskId).toBe("root");
  });
});
