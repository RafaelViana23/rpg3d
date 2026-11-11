import bpy
import math
import os
import sys
from mathutils import Vector


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.armatures:
        bpy.data.armatures.remove(block)


def get_mesh():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not meshes:
        raise RuntimeError('GLB sem malha')
    mesh = max(meshes, key=lambda obj: len(obj.data.vertices))
    world = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.matrix_world = world
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh.select_set(False)
    for obj in list(bpy.context.scene.objects):
        if obj != mesh and obj.type in {'ARMATURE', 'EMPTY'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    return mesh


def bounds(mesh):
    points = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def create_rig(mesh, rig_name):
    lo, hi = bounds(mesh)
    center_x = (lo.x + hi.x) * 0.5
    center_y = (lo.y + hi.y) * 0.5
    height = hi.z - lo.z
    z = lambda ratio: lo.z + height * ratio
    width = hi.x - lo.x

    armature = bpy.data.armatures.new(rig_name)
    rig = bpy.data.objects.new(rig_name, armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    def bone(name, head, tail, parent=None):
        b = armature.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = armature.edit_bones[parent]
            b.use_connect = False
        return b

    c = lambda x, zz: (center_x + x, center_y, zz)
    bone('Root', c(0, lo.z), c(0, z(.12)))
    bone('Hips', c(0, z(.40)), c(0, z(.53)), 'Root')
    bone('Spine', c(0, z(.53)), c(0, z(.72)), 'Hips')
    bone('Chest', c(0, z(.72)), c(0, z(.82)), 'Spine')
    bone('Head', c(0, z(.82)), c(0, hi.z), 'Chest')
    for side, sign in [('L', 1), ('R', -1)]:
        shoulder = width * .17 * sign
        elbow = width * .34 * sign
        hand = width * .49 * sign
        bone(f'UpperArm.{side}', c(shoulder, z(.76)), c(elbow, z(.71)), 'Chest')
        bone(f'LowerArm.{side}', c(elbow, z(.71)), c(hand, z(.68)), f'UpperArm.{side}')
        bone(f'UpperLeg.{side}', c(width * .09 * sign, z(.43)), c(width * .10 * sign, z(.23)), 'Hips')
        bone(f'LowerLeg.{side}', c(width * .10 * sign, z(.23)), c(width * .10 * sign, z(.025)), f'UpperLeg.{side}')
    bpy.ops.object.mode_set(mode='OBJECT')

    mesh.parent = rig
    modifier = mesh.modifiers.new('Armature', 'ARMATURE')
    modifier.object = rig
    for b in armature.bones:
        mesh.vertex_groups.new(name=b.name)

    torso_half = width * .20
    for vertex in mesh.data.vertices:
        p = mesh.matrix_world @ vertex.co
        rz = (p.z - lo.z) / height
        rx = p.x - center_x
        side = 'L' if rx >= 0 else 'R'
        ax = abs(rx)
        if rz >= .82:
            target = 'Head'
        elif rz >= .58 and ax > torso_half:
            target = f'LowerArm.{side}' if ax > width * .34 else f'UpperArm.{side}'
        elif rz >= .70:
            target = 'Chest'
        elif rz >= .53:
            target = 'Spine'
        elif rz >= .40:
            target = 'Hips'
        elif rz >= .21:
            target = f'UpperLeg.{side}'
        else:
            target = f'LowerLeg.{side}'
        mesh.vertex_groups[target].add([vertex.index], 1.0, 'REPLACE')
    return rig


def key_rotation(pose_bone, frame, xyz):
    pose_bone.rotation_mode = 'XYZ'
    pose_bone.rotation_euler = xyz
    pose_bone.keyframe_insert('rotation_euler', frame=frame)


def create_animations(rig):
    bpy.context.view_layer.objects.active = rig
    idle = bpy.data.actions.new('Idle')
    rig.animation_data_create()
    rig.animation_data.action = idle
    for frame, breath in [(1, 0), (20, math.radians(2)), (40, 0)]:
        key_rotation(rig.pose.bones['Spine'], frame, (breath, 0, 0))
        key_rotation(rig.pose.bones['UpperArm.L'], frame, (0, breath * .35, -breath * .2))
        key_rotation(rig.pose.bones['UpperArm.R'], frame, (0, -breath * .35, breath * .2))
    idle.use_fake_user = True

    walk = bpy.data.actions.new('Walk')
    rig.animation_data.action = walk
    poses = [(1, 1), (7, 0), (13, -1), (19, 0), (25, 1)]
    for frame, phase in poses:
        leg = math.radians(25) * phase
        arm = math.radians(22) * phase
        key_rotation(rig.pose.bones['UpperLeg.L'], frame, (leg, 0, 0))
        key_rotation(rig.pose.bones['UpperLeg.R'], frame, (-leg, 0, 0))
        key_rotation(rig.pose.bones['LowerLeg.L'], frame, (max(0, -leg) * .75, 0, 0))
        key_rotation(rig.pose.bones['LowerLeg.R'], frame, (max(0, leg) * .75, 0, 0))
        key_rotation(rig.pose.bones['UpperArm.L'], frame, (-arm, 0, 0))
        key_rotation(rig.pose.bones['UpperArm.R'], frame, (arm, 0, 0))
        key_rotation(rig.pose.bones['Spine'], frame, (0, 0, math.radians(2) * phase))
    walk.use_fake_user = True
    rig.animation_data.action = idle


def process(source, output):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=source)
    mesh = get_mesh()
    rig = create_rig(mesh, f'Rig_{os.path.basename(os.path.dirname(output))}')
    create_animations(rig)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 40
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_skins=True,
        export_morph=False,
    )


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2:
        raise SystemExit('uso: blender -b --python rig_characters.py -- entrada.glb saida.glb')
    process(os.path.abspath(args[0]), os.path.abspath(args[1]))
