import _ from 'underscore';
import React from 'react/addons';
import electron from 'electron';
const remote = electron.remote;
const dialog = remote.dialog;
import shell from 'shell';
import util from '../utils/Util';
import metrics from '../utils/MetricsUtil';
import containerActions from '../actions/ContainerActions';

var ContainerSettingsVolumes = React.createClass({

  getInitialState: function () {
    // Build an Array from the container 'Volumes' attribute
    let mounts = this.props.container.Mounts;
    mounts.push({
      Source: '',
      Destination: '',
      Driver: 'none'
    });

    return {
      mounts: mounts
    }
  },

  handleChooseVolumeClick: function (index) {
    var _this = this;
    dialog.showOpenDialog({properties: ['openDirectory', 'createDirectory']}, (filenames) => {
      if (!filenames) {
        return;
      }

      var directory = filenames[0];

      if (!directory || directory.indexOf(util.home()) === -1) {
        dialog.showMessageBox({
          type: 'warning',
          buttons: ['OK'],
          message: 'Invalid directory. Volume directories must be under your Users directory'
        });
        return;
      }

      metrics.track('Choose Directory for Volume');

      var mounts = _.clone(_this.state.mounts);
      _.each(mounts, function (m, k) {
        if (k === index) {
          m.Source = util.windowsToLinuxPath(directory);
          m.Driver = null;
        }
      });
      
      _this.writeToPropsContainer(mounts);
    });
  },
  handleAddVolumeClick: function () {
    metrics.track('Added Volume Directory', {
      from: 'settings'
    });
    
    var mounts = _.clone(this.state.mounts);
    mounts.push({
      Source: '',
      Destination: '',
      Driver: 'none'
    });
    this.setState({
      mounts: mounts
    });
    
    this.writeToPropsContainer(mounts);
  },
  handleRemoveVolumeClick: function (index) {
    metrics.track('Removed Volume Directory', {
      from: 'settings'
    });

    var mounts = _.clone(this.state.mounts);
    mounts.splice(index, 1);
    this.setState({
      mounts: mounts
    });
    
    this.writeToPropsContainer(mounts);
  },
  handleOpenVolumeClick: function (path) {
    metrics.track('Opened Volume Directory', {
      from: 'settings'
    });
    if (util.isWindows()) {
      shell.showItemInFolder(util.linuxToWindowsPath(path));
    } else {
      shell.showItemInFolder(path);
    }
  },
  handleSaveVolumesClick: function () {
    metrics.track('Saved Volumes');
    var mounts = [];

    this.writeToPropsContainer(mounts);
  },
  writeToPropsContainer: function(mounts, saveToHostConfig = false){
    // write to the docker's host config
    let binds = mounts.map(m => {
      return m.Source + ':' + m.Destination;
    });

    let hostConfig = _.extend(this.props.container.HostConfig, {Binds: binds});
    
    //update the container
    if (saveToHostConfig) {
      metrics.track('Write Host Config');
      containerActions.update(this.props.container.Name, {Mounts: mounts, HostConfig: hostConfig});
    } else {
      containerActions.update(this.props.container.Name, {Mounts: mounts});
    }
  },
  render: function () {
    var _this = this;
    if (!this.state.mounts) {
      return false;
    }

    var homeDir = util.isWindows() ? util.windowsToLinuxPath(util.home()) : util.home();
    var mounts= _.map(_this.state.mounts, (m, i) => {
      let source = m.Source, destination = m.Destination;
      if (!m.Source || m.Source.indexOf(homeDir) === -1) {
        source = (
          <span className="value-right">No Folder</span>
        );
      } else {
        let local = util.isWindows() ? util.linuxToWindowsPath(source) : source;
        source = (
          <a className="value-right" onClick={this.handleOpenVolumeClick.bind(this, source)}>{local.replace(process.env.HOME, '~')}</a>
        );
      }
      
      let action;
      if (i === _this.state.mounts.length - 1) {
        action = <a className="only-icon btn btn-positive small" disabled={this.props.container.State.Updating} onClick={this.handleAddVolumeClick.bind(this, i)}><span className="icon icon-add"></span></a>;
      } else {
        action = <a className="only-icon btn btn-action small" disabled={this.props.container.State.Updating} onClick={this.handleRemoveVolumeClick.bind(this, i)}><span className="icon icon-delete"></span></a>;
      }
      
      return (
        <tr>
          <td><input type="text" className="key line" >{destination}</input></td>
          <td>{source}</td>
          <td>
            <a className="btn btn-action small" disabled={this.props.container.State.Updating} onClick={this.handleChooseVolumeClick.bind(this, i)}>Change</a>
            {action}
          </td>
        </tr>
      );
    });
    return (
      <div className="settings-panel">
        <div className="settings-section">
          <h3>Configure Volumes</h3>
          <table className="table volumes">
            <thead>
              <tr>
                <th>DOCKER FOLDER</th>
                <th>LOCAL FOLDER</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mounts}
            </tbody>
          </table>
          <a className="btn btn-action" disabled={this.props.container.State.Updating} onClick={this.handleSaveVolumesClick}>Save</a>
        </div>
      </div>
    );
  }
});

module.exports = ContainerSettingsVolumes;
