# Runs inside Blender (headless). Reads the open .blend, welds + decimates each
# mesh in memory, and exports a web-sized GLB. Never saves the .blend.
import bpy, bmesh, math, sys
out = sys.argv[sys.argv.index("--") + 1]
TARGET = {"Palm": 26000, "ForeArm": 9000, "BackArm": 2500, "Button": 1600, "ButtonLED": 400,
          "Index3": 4200, "Middle3": 4200, "Ring3": 4200, "Pinky3": 4000, "Thumb1": 3200, "Thumb2": 4200}
DEFAULT = 2400  # the plain finger segments

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

total_before = total_after = 0
for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
    me = ob.data
    if me.users > 1:
        me = ob.data = me.copy()
    before = tri_count(me)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)   # STL triangles share no vertices until welded
    bm.to_mesh(me); bm.free()
    target = TARGET.get(ob.name, DEFAULT)
    welded = tri_count(me)
    if welded > target:
        mod = ob.modifiers.new("web_decimate", "DECIMATE")
        mod.ratio = target / welded
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = new_me
    for p in new_me.polygons:
        p.use_smooth = True
    new_me.set_sharp_from_angle(angle=math.radians(38))
    after = tri_count(new_me)
    total_before += before; total_after += after
    print("OPT %-10s %7d -> %6d tris, %d verts" % (ob.name, before, after, len(new_me.vertices)))
print("OPT TOTAL %d -> %d" % (total_before, total_after))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True, export_apply=True,
                          export_materials="NONE", export_texcoords=False, export_normals=True)
print("OPT exported", out)
