import {describe,expect,it} from "vitest";
import {popoverPosition} from "./popoverPosition";
describe("task planning panel positioning",()=>{
  it("opens below the trigger when space is available",()=>{
    expect(popoverPosition({right:1000,top:100,bottom:140},{width:300,height:200},{width:1200,height:800})).toMatchObject({left:700,top:148});
  });
  it("flips above a trigger near the bottom edge",()=>{
    const p=popoverPosition({right:1000,top:700,bottom:740},{width:300,height:200},{width:1200,height:800});
    expect(p.top).toBe(492);expect(p.top+200).toBeLessThan(700);
  });
  it("keeps the panel inside a narrow viewport",()=>{
    const p=popoverPosition({right:70,top:60,bottom:100},{width:300,height:220},{width:390,height:844});
    expect(p.left).toBe(12);expect(p.left+300).toBeLessThanOrEqual(378);
  });
  it("limits tall expanded content to the available space",()=>{
    const p=popoverPosition({right:370,top:400,bottom:440},{width:300,height:700},{width:390,height:844});
    expect(p.top).toBeGreaterThanOrEqual(12);expect(p.top+p.maxHeight).toBeLessThanOrEqual(832);
  });
});
