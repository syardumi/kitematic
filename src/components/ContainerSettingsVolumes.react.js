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
      mounts: mounts,
      hasChanged: false
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
      
      //refresh, don't write out
      _this.writeToPropsContainer(mounts);
    });
  },
  handleChangeDockerFolderClick: function(index, event) {
    metrics.track('Changed Docker Directory', {
      from: 'settings'
    });
    
    //set the destination on the volume
    var mounts = _.clone(this.state.mounts);
	_.each(mounts, function (m, k) {
	  if (k === index) {
	    m.Destination = event.target.value;
	  }
	});
      
    //refresh, don't write out
    this.writeToPropsContainer(mounts);
  },
  handleAddVolumeClick: function () {
    metrics.track('Added Volume Directory', {
      from: 'settings'
    });
    
    //add a blank volume slot
    var mounts = _.clone(this.state.mounts);
    mounts.push({
      Source: '',
      Destination: '',
      Driver: 'none'
    });
    
    //refresh, don't write out
    this.writeToPropsContainer(mounts);
  },
  handleClearVolumeClick: function (index) {
    metrics.track('Clear Volume Values', {
      from: 'settings'
    });
    
    //clear the index's text values
    var mounts = _.clone(this.state.mounts);
    _.each(mounts, function (m, k) {
	  if (k === index) {
	    m.Source = ''
	    m.Destination = '';
	    m.Driver = 'none';
	  }
	});
	
	//refresh, don't write out
    this.writeToPropsContainer(mounts);
  },
  handleRemoveVolumeClick: function (index) {
    metrics.track('Removed Volume Directory', {
      from: 'settings'
    });

    //remove a volume from the array
    var mounts = _.clone(this.state.mounts);
    mounts.splice(index, 1);
    
    //refresh, don't write out
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
    
    var mounts = _.clone(this.state.mounts);
    
    //validate mounts here
    let validatedMounts = [];
    _.each(mounts, function (m, k) {
      if (m.Source !== '' && m.Destination !== '') {
        validatedMounts.push(m);
      }
    });

    //refresh, don't write out
    this.writeToPropsContainer(validatedMounts, true);
  },
  writeToPropsContainer: function(mounts, saveToHostConfig = false){
    //set the state mounts for reuse
    this.setState({
      mounts: mounts,
      hasChanged: true
    });
    
    //update the container
    if (saveToHostConfig) { //*** write to docker's host config
      metrics.track('Write Host Config');
      
      this.setState({
        mounts: mounts,
        hasChanged: false
      });
      
      //*** write to the docker's host config
      let binds = mounts.map(m => {
        return m.Source + ':' + m.Destination;
      });

      let hostConfig = _.extend(this.props.container.HostConfig, {Binds: binds});
      
      let refreshMounts = _.clone(mounts);
      refreshMounts.push({
        Source: '',
        Destination: '',
        Driver: 'none'
      });
      this.setState({
        mounts: refreshMounts
      });
      containerActions.update(this.props.container.Name, {Mounts: mounts, HostConfig: hostConfig});
    } else { //don't write out, just an update/refresh to the container
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
      
      if (destination === '') {
        destination = <input type="text" className="key line" onBlur={this.handleChangeDockerFolderClick.bind(this, i)}></input>;
      }
      
      return (
        <tr>
          <td>{destination}</td>
          <td>{source}</td>
          <td>
            <a className="btn btn-action small" disabled={this.props.container.State.Updating} onClick={this.handleChooseVolumeClick.bind(this, i)}>Select Folder</a>
            <a className="btn btn-action small" disabled={this.props.container.State.Updating} onClick={this.handleClearVolumeClick.bind(this, i)}>Clear</a>
            {action}
          </td>
        </tr>
      );
    });
    
    let deltaIcon = '';
    if (this.state.hasChanged){
      deltaIcon = <span className="delta"></span>;
    }
    
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
          <a className="btn btn-action" disabled={this.props.container.State.Updating} onClick={this.handleSaveVolumesClick}>Save{deltaIcon}</a>
        </div>
      </div>
    );
  }
});

module.exports = ContainerSettingsVolumes;
