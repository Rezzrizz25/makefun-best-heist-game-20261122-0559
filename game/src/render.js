// The Midnight Vault — everything drawn, in one canvas. The playfield is a
// fixed 1280x720 logical area scaled to the window; the HUD lives in the
// same coordinates, so a click maps back to the world by one scale factor.
// Screens: title, play, paused, busted, won. Nothing here touches the rules.

import { CAMERA, FIELD, GUARD, LOOT, PALETTE, SMOKE, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'won';

/** HUD tool buttons, in logical coordinates: main.js tests clicks against them. */
export const TOOL_BUTTONS = [
  { key: '1', kind: 'smoke', label: 'SMOKE', x: 1010, y: 668, w: 78, h: 40 },
  { key: '2', kind: 'emp', label: 'EMP', x: 1094, y: 668, w: 78, h: 40 },
  { key: '3', kind: 'lockpick', label: 'PICK', x: 1178, y: 668, w: 78, h: 40 },
];

function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || ty >= level.map.length || tx >= level.map[0].length) return '#';
  return level.map[ty][tx];
}

function drawCone(ctx, x, y, angle, halfAngle, range, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
  ctx.strokeStyle = fill.replace(/[\d.]+\)$/, '0.55)');
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  function drawFloor(level) {
    for (let ty = 0; ty < level.map.length; ty += 1) {
      for (let tx = 0; tx < level.map[0].length; tx += 1) {
        const ch = level.map[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (ch === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 4);
          continue;
        }
        ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (ch === ',') {
          ctx.fillStyle = PALETTE.carpet;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = PALETTE.carpetEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
        }
      }
    }
  }

  function drawCover(level) {
    for (let ty = 0; ty < level.map.length; ty += 1) {
      for (let tx = 0; tx < level.map[0].length; tx += 1) {
        const ch = level.map[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (ch === 'X') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(x + 3, y + 3, TILE - 6, 6);
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        } else if (ch === 'D') {
          ctx.fillStyle = PALETTE.caseBase;
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = PALETTE.caseGlass;
          ctx.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x + 10, y + 10, 6, TILE - 20);
          ctx.fillStyle = PALETTE.gold;
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPatrolRoutes(state) {
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.strokeStyle = 'rgba(238,241,245,0.20)';
    ctx.lineWidth = 1.5;
    for (const guard of state.guards) {
      ctx.beginPath();
      guard.waypoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawExit(state) {
    const { x, y } = state.exit;
    ctx.fillStyle = PALETTE.exitDoor;
    ctx.fillRect(x - 18, y - 18, 36, 36);
    ctx.fillStyle = '#0e1016';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y - 1);
    ctx.strokeStyle = PALETTE.green;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 18.5, y - 18.5, 37, 37);
    // The getaway van waits outside: a pulsing arrow when the loot is in hand.
    if (state.vaultLoot) {
      const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 5);
      ctx.fillStyle = `rgba(47, 174, 95, ${0.5 + pulse * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(x, y - 30 - pulse * 4);
      ctx.lineTo(x - 7, y - 20 - pulse * 4);
      ctx.lineTo(x + 7, y - 20 - pulse * 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawVault(state) {
    const { x, y } = state.vault;
    const glow = state.vault.open ? 0.9 : 0.35 + 0.15 * Math.sin(state.elapsed * 2);
    const grad = ctx.createRadialGradient(x, y, 4, x, y, 90);
    grad.addColorStop(0, `rgba(242, 201, 76, ${glow})`);
    grad.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = state.vault.open ? '#3a2f10' : PALETTE.vaultDoor;
    ctx.fillRect(x - 19, y - 19, 38, 38);
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 19.5, y - 19.5, 39, 39);
    if (state.vault.open) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#6b5510';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f7dc6f';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    }
    // Cracking progress ring.
    if (state.cracking) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + state.crackProgress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.vault.open ? 'VAULT · OPEN' : 'VAULT', x, y + 32);
  }

  function drawLoot(state) {
    for (const loot of state.loots) {
      if (loot.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 4 + loot.x);
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(242, 201, 76, ${pulse})`;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = '#f7dc6f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8.5, -8.5, 17, 17);
      ctx.restore();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`$${LOOT.side}`, loot.x, loot.y + 24);
    }
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      ctx.fillStyle = '#b8c4d4';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', pickup.x, pickup.y + 0.5);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('SMOKE', pickup.x, pickup.y + 22);
    }
  }

  function drawSmoke(state) {
    for (const smoke of state.smokes) {
      const alpha = Math.min(0.75, smoke.ttl / 2);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + state.elapsed * 0.4;
        const cx = smoke.x + Math.cos(a) * SMOKE.radius * 0.45;
        const cy = smoke.y + Math.sin(a) * SMOKE.radius * 0.45;
        ctx.fillStyle = `rgba(184, 196, 212, ${alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(cx, cy, SMOKE.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const fill = guard.alerted ? PALETTE.coneAlert : guard.suspicion > 0.5 ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      drawCone(ctx, guard.x, guard.y, guard.facing, GUARD.viewHalfAngle, GUARD.viewRange, fill);
    }
    for (const guard of state.guards) {
      ctx.fillStyle = guard.alerted ? PALETTE.guardAlert : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Facing tick and cap brim.
      ctx.strokeStyle = '#dfe6ef';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 6), guard.y + Math.sin(guard.facing) * (guard.radius + 6));
      ctx.stroke();
      ctx.fillStyle = '#dfe6ef';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', guard.x, guard.y + 0.5);
      if (guard.alerted) {
        ctx.fillStyle = PALETTE.red;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('!', guard.x, guard.y - guard.radius - 12);
      } else if (guard.suspicion > 0.25) {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText('?', guard.x, guard.y - guard.radius - 10);
      }
      // Suspicion arc over a wary guard.
      if (guard.suspicion > 0.02 && !guard.alerted) {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius + 5, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      const disabled = state.empTimer > 0;
      if (!disabled) {
        drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, camera.seesThief ? PALETTE.coneAlert : PALETTE.coneCamera);
      }
      ctx.fillStyle = disabled ? '#4a4f5a' : '#20242e';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = camera.seesThief ? PALETTE.red : '#7fa6c9';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = camera.seesThief ? PALETTE.red : disabled ? '#6a707c' : '#7fa6c9';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (disabled) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMP ' + Math.ceil(state.empTimer) + 's', camera.x, camera.y - 16);
      }
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const r = thief.sneaking ? thief.radius * 0.85 : thief.radius;
    // A soft shadow of where the thief is headed while moving.
    if (thief.moving) {
      ctx.fillStyle = 'rgba(238,241,245,0.10)';
      ctx.beginPath();
      ctx.arc(thief.x + thief.dirX * 26, thief.y + thief.dirY * 26, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.thiefHood;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thief;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood point and face: the direction the thief is looking.
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(thief.x + thief.dirX * r * 0.45, thief.y + thief.dirY * r * 0.45, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (thief.sneaking) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', thief.x, thief.y - r - 8);
    }
    // Loot sack when the vault is open.
    if (state.vaultLoot) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(thief.x - thief.dirX * (r + 4), thief.y - thief.dirY * (r + 4), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, view) {
    // Top bar.
    ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.level.name, 14, 15);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(state.level.sub, 14, 33);
    // Loot and time, right side.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('$' + state.loot.toLocaleString('en-US'), FIELD.width - 14, 15);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px system-ui, sans-serif';
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60).toString().padStart(2, '0');
    ctx.fillText('time ' + mins + ':' + secs, FIELD.width - 14, 33);
    // Alarm meter, centre.
    const ax = FIELD.width / 2 - 130;
    const ay = 12;
    ctx.textAlign = 'left';
    ctx.fillStyle = state.lockdown > 0 ? PALETTE.red : PALETTE.muted;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(state.lockdown > 0 ? 'LOCKDOWN ' + Math.ceil(state.lockdown) + 's' : 'ALARM', ax, ay + 5);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(ax + 92, ay, 168, 12);
    const frac = state.alarm / 100;
    ctx.fillStyle = frac < 0.4 ? PALETTE.green : frac < 0.75 ? PALETTE.gold : PALETTE.red;
    ctx.fillRect(ax + 92, ay, 168 * frac, 12);
    ctx.strokeStyle = 'rgba(238,241,245,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 91.5, ay - 0.5, 169, 13);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(state.alarm) + '%', ax + 92 + 168 + 34, ay + 6);
    // Tool buttons, bottom right.
    for (const btn of TOOL_BUTTONS) {
      const count = state.tools[btn.kind];
      const usable = count > 0 && (btn.kind !== 'lockpick' || !state.vault.open);
      ctx.fillStyle = usable ? 'rgba(37, 43, 56, 0.92)' : 'rgba(20, 23, 30, 0.85)';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = usable ? PALETTE.gold : 'rgba(154,163,178,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
      ctx.fillStyle = usable ? PALETTE.text : PALETTE.muted;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(btn.key + ' ' + btn.label, btn.x + 8, btn.y + 14);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('x' + count, btn.x + 8, btn.y + 30);
    }
    // Hint line, bottom left.
    const hint = state.hint || 'WASD move · Shift sneak · E crack vault · 1 smoke · 2 EMP · 3 lockpick · click a tool or the floor to walk';
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    const hintW = ctx.measureText(hint).width + 18;
    ctx.fillRect(10, 668, hintW, 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(hint, 19, 688);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 15, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 310 + i * 30);
    });
  }

  function draw(state, screen, view) {
    fit();
    const level = state.level;
    drawFloor(level);
    drawPatrolRoutes(state);
    drawExit(state);
    drawVault(state);
    drawLoot(state);
    drawSmoke(state);
    drawGuards(state);
    drawCameras(state);
    drawThief(state);
    drawHud(state, view);
    if (screen === SCREEN_TITLE) {
      overlay('THE MIDNIGHT VAULT', [
        'A three-floor stealth heist. Read the cones, mind the cameras,',
        'crack the vault and walk out the green door with the loot.',
        '',
        'WASD / arrows — move      Shift — sneak      E — crack the vault',
        '1 — smoke pellet      2 — EMP      3 — lockpick      Click — walk / use a tool',
        '',
        'Press Space or click to start.  Best take so far: $' + (view.best || 0).toLocaleString('en-US'),
      ], PALETTE.gold);
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['The crew waits in the dark.', 'Press P, Space or click to carry on.'], PALETTE.text);
    } else if (screen === SCREEN_BUSTED) {
      overlay('BUSTED', [
        view.bustedReason || 'The law caught up with the crew.',
        'Take so far this job: $' + state.loot.toLocaleString('en-US'),
        '',
        'Press R or Space to run this floor again.',
      ], PALETTE.red);
    } else if (screen === SCREEN_WIN) {
      const take = view.take || { total: state.loot, ghost: false, timeBonus: 0 };
      overlay(view.finalWin ? 'THE CREW RETIRES RICH' : 'CLEAN GETAWAY', [
        'Vault loot: $' + LOOT.vault.toLocaleString('en-US') + '   Side loot: $' + (state.loot - (state.vaultLoot ? LOOT.vault : 0)).toLocaleString('en-US'),
        (take.ghost ? 'Ghost bonus (never raised the alarm): $' + LOOT.ghostBonus.toLocaleString('en-US') : 'The alarm saw you — no ghost bonus this time.'),
        'Time bonus: $' + take.timeBonus.toLocaleString('en-US'),
        'This floor: $' + take.total.toLocaleString('en-US') + (view.finalWin ? '   ·   Whole job: $' + (view.totalTake || take.total).toLocaleString('en-US') : ''),
        '',
        view.finalWin ? 'Press Space to run the job again.' : 'Press Space for the next floor.',
      ], PALETTE.green);
    }
  }

  return { draw };
}
