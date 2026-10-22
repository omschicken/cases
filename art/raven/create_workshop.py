"""Blender 4.3+: authoring workshop, NOT a final Raven asset.
Run: blender --background --python create_workshop.py -- OUTPUT.blend REFERENCE.webp
Only this new document is initialized; never run inside an unsaved artist document.
"""
import bpy
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
destination = Path(args[0]).resolve()
reference = Path(args[1]).resolve() if len(args) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1440
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 30
scene.frame_end = 300
scene['STATUS'] = 'AUTHORING WORKSHOP — NOT VISUALLY APPROVED; NO FINAL BIRD/RELIEF/TEXTURES'
scene['coordinates'] = 'Blender: Z-up, front -Y; exported GLB: Y-up, front +Z. Metres.'

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

case_col = collection('01_RavenCase_WIP')
bird_col = collection('02_RavenBird_RIG_TEMPLATE_NO_MESH')
env_col = collection('03_Environment_COMPOSITION_ONLY')
camera_col = collection('04_Cameras_Lights')
ref_col = collection('05_References_NOT_EXPORTED')
ref_col.hide_render = True

def move(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)
    return obj

def empty(name, col, location=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    col.objects.link(o)
    o.empty_display_type = 'PLAIN_AXES'
    o.empty_display_size = .16
    o.parent = parent
    o.location = location
    return o

def material(name, color, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    m['status'] = 'LOOKDEV VALUES ONLY — IMAGE MAPS MUST BE AUTHORED/BAKED'
    return m

steel = material('WIP_BlackenedSteel', (.038, .044, .046), .82, .38)
hardware = material('WIP_WornHardware', (.25, .24, .20), .9, .32)
rubber = material('WIP_Seal', (.014, .016, .015), 0, .8)
stone = material('WIP_Travertine_Composition', (.62, .57, .47), 0, .72)

def bevel(obj, amount=.018, segments=3):
    mod = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
    mod.width = amount
    mod.segments = segments
    mod = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True

def cube(name, dimensions, location, mat, parent=None, col=case_col, radius=.015):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = move(bpy.context.object, col)
    o.name = name
    o.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent = parent
    o.location = location
    o.data.materials.append(mat)
    bevel(o, radius)
    return o

def cylinder(name, radius, depth, location, parent, rotation=(0, 0, 0), mat=hardware):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth)
    o = move(bpy.context.object, case_col)
    o.name = name
    o.parent = parent
    o.location = location
    o.rotation_euler = rotation
    o.data.materials.append(mat)
    bevel(o, .003, 2)
    return o

root = empty('RavenCase', case_col)
root['visualApproved'] = False
body = empty('CaseBody', case_col, parent=root)
# Open shell, not a solid cube: explicit wall thickness and visible interior.
cube('Body_Bottom', (2.65, 1.65, .09), (0, 0, .08), steel, body)
cube('Body_Front', (2.65, .085, .87), (0, -.785, .52), steel, body)
cube('Body_Back', (2.65, .085, .87), (0, .785, .52), steel, body)
for sign in [-1, 1]:
    cube('Body_Side', (.085, 1.5, .87), (sign * 1.28, 0, .52), steel, body)
    for y in [-.76, .76]:
        cube('CornerVertical', (.15, .15, .92), (sign * 1.24, y, .52), hardware, body, radius=.022)
    for z in [.16, .85]:
        cube('CornerRail', (.18, 1.59, .12), (sign * 1.23, 0, z), hardware, body)
    # Handle pocket and bail are separate meshes; artist can refine the silhouette.
    cube('HandleBackplate', (.045, .6, .32), (sign * 1.335, 0, .54), rubber, body)
    for y in [-.22, .22]:
        cube('HandleMount', (.07, .075, .22), (sign * 1.36, y, .54), hardware, body)
    cylinder('HandleGrip', .035, .44, (sign * 1.4, 0, .6), body, (math.pi / 2, 0, 0))
for x in [-1.22, -.95, .95, 1.22]:
    for z in [.19, .82]:
        cylinder('FrontFastener', .025, .025, (x, -.841, z), body, (math.pi / 2, 0, 0))
for y in [-.75, .75]:
    cube('RimSeal', (2.5, .04, .04), (0, y, .973), rubber, body, radius=.008)

lid = empty('CaseLid', case_col, (0, .8, 1), root)
lid['pivot_note'] = 'Rear hinge, local X. Closed=0deg, open=-108deg. Children in local coordinates.'
cube('LidShell', (2.7, 1.7, .16), (0, -.8, .10), steel, lid)
cube('LidInsetPanel', (2.3, 1.32, .035), (0, -.8, .195), steel, lid, radius=.025)
for x in [-1.24, 1.24]:
    cube('LidArmour', (.16, 1.67, .12), (x, -.8, .17), hardware, lid)
    for y in [-1.5, -.1]:
        cylinder('LidFastener', .023, .02, (x, y, .239), lid)

for label, x in [('LockLeft', -.85), ('LockRight', .85)]:
    lock = empty(label, case_col, (x, -.88, 1), root)
    lock['pivot_note'] = 'Latch hinge, local X; closed=0deg, released=+80deg'
    cube(label + '_Lever', (.18, .075, .30), (0, 0, -.11), hardware, lock, radius=.012)
    cylinder(label + '_Pin', .034, .24, (0, 0, 0), lock, (0, math.pi / 2, 0))
    cube(label + '_Receiver', (.23, .045, .13), (x, -.855, .69), hardware, body)
hinge = empty('Hinge', case_col, parent=root)
for x in [-.82, .82]:
    for i in range(5):
        cylinder('HingeKnuckle', .05, .07, (x + (i - 2) * .073, .8, 1), hinge, (0, math.pi / 2, 0))
    cube('HingeLeafBody', (.4, .04, .16), (x, .823, .9), hardware, hinge)
    cube('HingeLeafLid', (.4, .03, .1), (x, 0, .07), hardware, lid)
interior = empty('Interior', case_col, parent=root)
cube('InteriorTray', (2.38, 1.36, .07), (0, 0, .18), rubber, interior)
relief = empty('RavenRelief', case_col, (-.82, -.86, .58), root)
relief['status'] = 'MISSING: custom sculpt + retopology + baked feather relief, NOT a stand-in mesh'
logo = empty('Logo', case_col, (.43, -.836, .52), root)
logo['status'] = 'MISSING: approved Casecrow raven vector geometry/decal; do not invent another logo'
empty('Perch', case_col, (0, 0, 1.22), root)
empty('RevealAnchor', case_col, (0, 0, 1.65), root)
envelope = empty('CaseEnvelope_REFERENCE_ONLY', ref_col, (0, 0, .62))
envelope.empty_display_type = 'CUBE'
envelope.scale = (1.35, .85, .62)

# Mechanical test animation only; not falsely labelled as final character clips.
for frame, angle in [(1, 0), (180, 0), (213, -108), (300, -108)]:
    lid.rotation_euler.x = math.radians(angle)
    lid.keyframe_insert('rotation_euler', frame=frame)
lid.animation_data.action.name = 'WORKSHOP_LidPivotTest'
for name in ['LockLeft', 'LockRight']:
    o = bpy.data.objects[name]
    for frame, angle in [(1, 0), (163, 0), (179, 80), (300, 80)]:
        o.rotation_euler.x = math.radians(angle)
        o.keyframe_insert('rotation_euler', frame=frame)
    o.animation_data.action.name = 'WORKSHOP_' + name + '_PivotTest'

# Bare skeleton to communicate scale and anatomy; no fake bird geometry/animations.
bird_root = empty('RavenBird', bird_col, (0, 0, 1.22))
bird_root['status'] = 'RIG TEMPLATE ONLY — import a licensed bird or author a real mesh and weights'
arm = bpy.data.armatures.new('RavenAnatomyTemplate')
rig = bpy.data.objects.new('RavenRig_TEMPLATE', arm)
bird_col.objects.link(rig)
rig.parent = bird_root
rig.show_in_front = True
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = arm.edit_bones.new(name); b.head = head; b.tail = tail
    if parent: b.parent = arm.edit_bones[parent]
    return b
bone('root', (0, 0, 0), (0, 0, .12))
bone('body', (0, 0, .12), (0, 0, .4), 'root')
bone('neck', (0, 0, .4), (0, -.06, .53), 'body')
bone('head', (0, -.06, .53), (0, -.22, .56), 'neck')
bone('tail', (0, .07, .3), (0, .4, .12), 'body')
for sign, side in [(-1, 'L'), (1, 'R')]:
    bone('upperwing.' + side, (sign * .08, 0, .36), (sign * .37, .04, .34), 'body')
    bone('forewing.' + side, (sign * .37, .04, .34), (sign * .68, .08, .3), 'upperwing.' + side)
    bone('wingtip.' + side, (sign * .68, .08, .3), (sign * .92, .18, .23), 'forewing.' + side)
    bone('thigh.' + side, (sign * .07, 0, .24), (sign * .09, .04, .12), 'body')
    bone('shin.' + side, (sign * .09, .04, .12), (sign * .09, -.02, .04), 'thigh.' + side)
    bone('foot.' + side, (sign * .09, -.02, .04), (sign * .09, -.14, .01), 'shin.' + side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(False)

# Architectural composition board: editable meshes, no final material claim.
environment = empty('CasecrowEnvironment', env_col)
environment['status'] = 'COMPOSITION BLOCKING: replace stone with licensed baked PBR; add authored olive branches'
cube('Plinth', (4.8, 3.8, .22), (0, 0, -.14), stone, environment, env_col, .04)
cube('Courtyard', (18, 18, .3), (0, 0, -.8), stone, environment, env_col, .04)
for i in range(3):
    cube('Step_%02d' % i, (6.2 + i * .6, 4.8 + i * .6, .18), (0, .3, -.32 - i * .18), stone, environment, env_col, .025)
for x in [-4.2, 4.2]:
    cube('ColumnBase', (1, 1, .25), (x, 3.4, -.5), stone, environment, env_col, .03)
    cube('SquareColumn', (.65, .65, 4.7), (x, 3.4, 1.97), stone, environment, env_col, .025)
cube('RearWall', (14, .35, 4), (0, 5.5, 1.3), stone, environment, env_col, .04)
empty('OliveBranches_IMPORT_HERE', env_col, (-3, 2.6, 1.2))
empty('SunShadowFoliage_IMPORT_HERE', env_col, (-4, -1, 4))

focus = empty('Focus_Case', camera_col, (0, 0, .75))
def camera(name, pos, target, lens):
    data = bpy.data.cameras.new(name); data.lens = lens
    o = bpy.data.objects.new(name, data); camera_col.objects.link(o); o.location = pos
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()
    data.dof.use_dof = True; data.dof.focus_object = focus; data.dof.aperture_fstop = 5.6
    return o
hero = camera('Camera_Hero', (4.2, -6.6, 3), (0, 0, .75), 48)
camera('Camera_Front_Inspection', (0, -6.5, 1.8), (0, 0, .7), 55)
camera('Camera_Relief_Inspection', (-3.3, -4, 2), (-.7, -.6, .65), 60)
scene.camera = hero
for name, kind, location, energy, color, size in [
    ('Sun_GoldenHour', 'SUN', (-4, -3, 6), 2.3, (1, .84, .63), .08),
    ('SoftSky', 'AREA', (1, -1, 6), 850, (.82, .9, 1), 5),
    ('EdgeBounce', 'AREA', (3, 2, 3), 500, (1, .9, .72), 4),
]:
    data = bpy.data.lights.new(name, kind); data.energy = energy; data.color = color
    if kind == 'SUN': data.angle = size
    else: data.shape = 'DISK'; data.size = size
    o = bpy.data.objects.new(name, data); camera_col.objects.link(o); o.location = location
    o.rotation_euler = (Vector((0, 0, .7)) - o.location).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('Sky_Workshop')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .72, .82, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35

if reference and reference.exists():
    image = bpy.data.images.load(str(reference)); image.pack()
    obj = empty('REFERENCE_Original_Raven_NOT_GEOMETRY', ref_col, (-4.8, 0, 2))
    obj.empty_display_type = 'IMAGE'; obj.data = image; obj.empty_display_size = 3
    obj.rotation_euler = (math.pi / 2, 0, 0)

for frame, name in [(1, 'CLOSED / INSPECT'), (30, 'Fly — MISSING BIRD CLIP'), (90, 'Landing — MISSING'), (120, 'Idle — MISSING'), (145, 'Takeoff — MISSING'), (163, 'UNLOCK TEST'), (180, 'LID TEST'), (214, 'REVEAL ANCHOR')]:
    scene.timeline_markers.new(name, frame=frame)
text = bpy.data.texts.new('START_HERE_README')
text.write('''CASECROW RAVEN — AUTHORING WORKSHOP, NOT FINAL ART

Created: hard-surface case base, open cavity, separate lid/latches/hinges,
handles, fasteners, named pivots, UV seed, bare bird anatomy skeleton,
composition architecture, cameras and lighting. No fake bird mesh.

Missing: sculpted RavenRelief, approved Logo mesh, final feathered bird,
skinning, Fly/Landing/Idle/Takeoff/FlyAway, authored PBR maps, botanical assets.
Image reference is for inspection only and never rendered as the 3D asset.
The material values are look-development swatches, not baked texture maps.

Select CaseLid; frame 1 = closed, 213 = open. Frames 163-179 test locks.
RavenRig_TEMPLATE is NOT a finished rig or purchased asset.

See BLENDER_GUIDE_RU.md for exact steps. export_assets.py deliberately refuses
export until required geometry, image maps, clips and approval are present.
Never publish licensed model source to the public GitHub repository.
''')
# Initial UVs are practical starting points, not hand-packed final baking UVs.
for o in list(case_col.objects):
    if o.type != 'MESH': continue
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    o['uv_status'] = 'AUTO STARTING UV — review packing/texel density before baking'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); bpy.context.view_layer.objects.active = body
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.shading.type = 'MATERIAL'
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
report = {'status': 'AUTHORING_NOT_FINAL', 'objects': len(scene.objects), 'caseMeshObjects': sum(o.type == 'MESH' for o in case_col.objects), 'bones': len(arm.bones), 'missing': ['RavenRelief mesh', 'Logo mesh', 'RavenBird mesh and skinning', 'five bird clips', 'PBR image maps', 'final environment']}
destination.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
