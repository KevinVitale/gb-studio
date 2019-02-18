import React, { Component } from "react";
import { connect } from "react-redux";
import cx from "classnames";
import * as actions from "../actions";
import getCoords from "../lib/getCoords";
import Actor from "./Actor";
import SceneCollisions from "./SceneCollisions";

class Scene extends Component {
  constructor() {
    super();
    this.state = {
      hover: false,
      hoverX: 0,
      hoverY: 0
    };
  }

  componentWillMount() {
    window.addEventListener("mousemove", this.onMoveDrag);
    window.addEventListener("mouseup", this.onEndDrag);
  }

  componentWillUnmount() {
    window.removeEventListener("mousemove", this.onMoveDrag);
    window.removeEventListener("mouseup", this.onEndDrag);
  }

  onMouseMove = e => {
    const { id, tool, editor, scene, showCollisions, zoomRatio } = this.props;
    const { creating, downX, downY } = this.state;

    const pos = getCoords(e.currentTarget);
    const x = e.pageX - pos.left;
    const y = e.pageY - pos.top;
    const tX = Math.floor(x / (8 * zoomRatio));
    const tY = Math.floor(y / (8 * zoomRatio));

    if (creating) {
      if (tool === "collisions") {
        if (this.remove) {
          this.props.removeCollisionTile(id, tX, tY);
        } else {
          this.props.addCollisionTile(id, tX, tY);
        }
      } else if (tool === "triggers") {
        this.props.resizeTrigger(id, 0, downX, downY, tX, tY);
      } else if (tool === "eraser") {
        if (showCollisions) {
          this.props.removeCollisionTile(id, tX, tY);
        }
      } else if (tool === "select") {
        if (editor.type === "triggers") {
          this.props.moveTrigger(
            id,
            editor.index,
            tX - this.state.hoverX,
            tY - this.state.hoverY
          );
        } else if (editor.type === "actors") {
          this.props.moveActor(
            id,
            editor.index,
            tX - this.state.hoverX,
            tY - this.state.hoverY
          );
        }
      }
    }

    let actor = this.actorAt(tX, tY);

    this.props.setStatus({
      sceneName: scene.name,
      x: tX,
      y: tY,
      actor: actor && (actor.name || "Actor " + (scene.actors.indexOf(actor) + 1))
    });

    this.setState({
      hover: true,
      hoverX: tX,
      hoverY: tY
    });
  };

  onMouseDown = e => {
    const { id, tool, scene, width, showCollisions } = this.props;
    const { hoverX, hoverY } = this.state;
    if (tool === "select") {
      let trigger = this.triggerAt(hoverX, hoverY);
      let actor = this.actorAt(hoverX, hoverY);
      if (trigger) {
        this.props.selectTrigger(id, scene.triggers.indexOf(trigger));
      } else if (actor) {
        this.props.selectActor(id, scene.actors.indexOf(actor));
      } else {
        this.props.selectScene(id);
      }
    } else if (tool === "actor") {
      this.props.addActor(id, hoverX, hoverY);
    } else if (tool === "collisions") {
      const collisionIndex = width * hoverY + hoverX;
      const collisionByteIndex = collisionIndex >> 3;
      const collisionByteOffset = collisionIndex & 7;
      const collisionByteMask = 1 << collisionByteOffset;

      if (scene.collisions[collisionByteIndex] & collisionByteMask) {
        this.props.removeCollisionTile(id, hoverX, hoverY);
        this.remove = true;
      } else {
        this.props.addCollisionTile(id, hoverX, hoverY);
        this.remove = false;
      }
    } else if (tool === "triggers") {
      let trigger = this.triggerAt(hoverX, hoverY);
      if (trigger) {
        this.props.selectTrigger(id, scene.triggers.indexOf(trigger));
      } else {
        this.props.addTrigger(id, hoverX, hoverY);
      }
    } else if (tool === "eraser") {
      if (showCollisions) {
        this.props.removeCollisionTile(id, hoverX, hoverY);
      }
      this.props.removeActorAt(id, hoverX, hoverY);
      this.props.removeTriggerAt(id, hoverX, hoverY);
      this.remove = true;
    }
    this.setState({
      creating: true,
      downX: hoverX,
      downY: hoverY
    });
  };

  onMouseLeave = e => {
    this.setState({
      hover: false
    });
  };

  onStartDrag = e => {
    const { id } = this.props;
    this.lastPageX = e.pageX;
    this.lastPageY = e.pageY;
    this.setState({
      dragging: true
    });
    this.props.selectScene(id);
  };

  onMoveDrag = e => {
    const { id, zoomRatio } = this.props;
    const { dragging } = this.state;
    if (dragging) {
      const dragX = e.pageX - this.lastPageX;
      const dragY = e.pageY - this.lastPageY;

      this.lastPageX = e.pageX;
      this.lastPageY = e.pageY;

      this.props.moveScene(id, dragX / zoomRatio, dragY / zoomRatio);
    }
  };

  onEndDrag = e => {
    const { tool } = this.props;
    if (this.state.creating && (tool === "actor" || tool === "triggers")) {
      this.props.setTool("select");
    }
    this.setState({
      dragging: false,
      creating: false
    });
  };

  triggerAt = (x, y) => {
    const { scene } = this.props;
    const { triggers = [] } = scene;
    return triggers.find(
      trigger =>
        x >= trigger.x &&
        x < trigger.x + trigger.width &&
        y >= trigger.y &&
        y < trigger.y + trigger.height
    );
  };

  actorAt = (x, y) => {
    const { scene } = this.props;
    const { actors = [] } = scene;
    return actors.find(
      actor => x >= actor.x && x < actor.x + 2 && y === actor.y
    );
  };

  render() {
    const {
      id,
      scene,
      tool,
      editor,
      image,
      worldId,
      width,
      height,
      projectRoot,
      showCollisions
    } = this.props;
    const { x, y, triggers = [], collisions = [], actors = [] } = scene;

    const { hover, hoverX, hoverY } = this.state;

    const sceneSelected = editor.scene === id;

    return (
      <div
        className={cx("Scene", { "Scene--Selected": sceneSelected })}
        style={{
          top: y,
          left: x
        }}
      >
        <div
          className="Scene__Name"
          onMouseDown={this.onStartDrag}
          onMouseMove={this.onMoveDrag}
          onMouseUp={this.onEndDrag}
        >
          {scene.name}
        </div>
        <div
          className="Scene__Image"
          style={{
            width: width * 8,
            height: height * 8,
            backgroundImage:
              image &&
              `url("${projectRoot}/assets/backgrounds/${image}")`
          }}
          onMouseMove={this.onMouseMove}
          onMouseDown={this.onMouseDown}
          onMouseLeave={this.onMouseLeave}
        >
          {triggers.map((trigger, index) => (
            <div
              key={index}
              className={cx("Scene__Trigger", {
                "Scene__Trigger--Selected":
                  editor.type === "triggers" &&
                  editor.scene === id &&
                  editor.index === index
              })}
              style={{
                top: trigger.y * 8,
                left: trigger.x * 8,
                width: trigger.width * 8,
                height: trigger.height * 8
              }}
            />
          ))}
          {showCollisions && (
            <SceneCollisions
              width={width}
              height={height}
              collisions={collisions}
            />
          )}
          {false &&
            showCollisions &&
            collisions.map((collision, index) =>
              collision ? (
                <div
                  key={index}
                  className="Scene__Collision"
                  style={{
                    top: Math.floor(index / width) * 8,
                    left: (index % width) * 8,
                    width: 8,
                    height: 8
                  }}
                />
              ) : (
                  undefined
                )
            )}
          {actors.map((actor, index) => (
            <Actor key={index} x={actor.x} y={actor.y} actor={actor} />
          ))}
          {tool === "actor" && hover && (
            <div className="Scene__Ghost">
              <Actor x={hoverX} y={hoverY} />
            </div>
          )}
          {hover && (
            <div
              className="Scene__Hover"
              style={{
                top: hoverY * 8,
                left: hoverX * 8
              }}
            />
          )}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, props) {
  const image = state.project.images.find(
    image => image.id === props.scene.imageId
  );
  return {
    projectRoot: state.document && state.document.root,
    tool: state.tools.selected,
    editor: state.editor,
    image: image && image.filename,
    width: image ? image.width : 32,
    height: image ? image.height : 32,
    worldId: state.project.id,
    showCollisions:
      (state.project.settings && state.project.settings.showCollisions) ||
      state.tools.selected === "collisions",
    zoomRatio:
      ((state.project &&
        state.project.settings &&
        state.project.settings.zoom) ||
        100) / 100
  };
}

const mapDispatchToProps = {
  moveScene: actions.moveScene,
  addActor: actions.addActor,
  selectActor: actions.selectActor,
  moveActor: actions.moveActor,
  removeActorAt: actions.removeActorAt,
  addCollisionTile: actions.addCollisionTile,
  removeCollisionTile: actions.removeCollisionTile,
  addTrigger: actions.addTrigger,
  removeTriggerAt: actions.removeTriggerAt,
  resizeTrigger: actions.resizeTrigger,
  moveTrigger: actions.moveTrigger,
  selectTrigger: actions.selectTrigger,
  selectScene: actions.selectScene,
  setTool: actions.setTool,
  setStatus: actions.setStatus
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Scene);
