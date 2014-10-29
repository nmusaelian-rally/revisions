Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    _artifacts:[],
    launch: function() {
        var today = new Date().toISOString();
        var that = this;
        var artifacts = Ext.create('Rally.data.wsapi.Store', {
            model: 'UserStory',
            fetch: ['ObjectID', 'FormattedID','Name','RevisionHistory','Revisions','Description','User'],
            autoLoad: true,
            filters: [
                {
                    property: 'Iteration.StartDate',
                    operator: '<=',
                    value: today
                },
                {
                    property: 'Iteration.EndDate',
                    operator: '>=',
                    value: today
                }
            ]
        });
        artifacts.load().then({
            success: this._getRevHistoryModel,
            scope: this
        }).then({
            success: this._onRevHistoryModelCreated,
            scope: this
        }).then({
            success: this._onModelLoaded,
            scope: this
        }).then({
            success: this._stitchDataTogether,
            scope: this
        }).then({
            success:function(results) {
                that._makeGrid(results);
            },
            failure: function(){
                console.log("oh noes!");
            }
        });
    },
    _getRevHistoryModel:function(artifacts){
        this._artifacts = artifacts;
        return Rally.data.ModelFactory.getModel({
            type: 'RevisionHistory'
        });
    },
  _onRevHistoryModelCreated: function(model) {
    var that = this;
    var promises = [];
    _.each(this._artifacts, function(artifact){
      var ref = artifact.get('RevisionHistory')._ref;
      console.log(artifact.get('FormattedID'), ref);
        promises.push(model.load(Rally.util.Ref.getOidFromRef(ref)));
    }); 
    return Deft.Promise.all(promises);  
   },
    
    _onModelLoaded: function(histories) {
      var promises = [];
      _.each(histories, function(history){
        var revisions = history.get('Revisions');
        revisions.store = history.getCollection('Revisions',{fetch:['User','Description','CreationDate', 'RevisionNumber']});
        promises.push(revisions.store.load());
      });
      return Deft.Promise.all(promises);  
    },
    _stitchDataTogether:function(revhistories){
      var that = this;
      var artifactsWithRevs = [];
      _.each(that._artifacts, function(artifact){
        artifactsWithRevs.push({artifact: artifact.data});
      });
      var i = 0;
      _.each(revhistories, function(revisions){
        artifactsWithRevs[i].revisions = revisions;
        i++;
      });
      return artifactsWithRevs;

    },

    _makeGrid: function(artifactsWithRevs){
      console.log(artifactsWithRevs);

        this.add({
            xtype: 'rallygrid',
            showPagingToolbar: true,
            showRowActionsColumn: false,
            editable: false,
            store: Ext.create('Rally.data.custom.Store', {
                data: artifactsWithRevs
            }),
            columnCfgs: [
                {
                    text: 'FormattedID', dataIndex: 'artifact', 
                      renderer:function(value){
                        return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + value.ObjectID + '" target="_blank">' + value.FormattedID + '</a>';
                    }
                },
                {
                    text: 'Name',dataIndex: 'artifact',
                    renderer:function(value){
                        return value.Name;
                    }
                },
                {
                    text: 'Revision author',dataIndex: 'revisions',
                    renderer:function(value){
                        var html = [];
                        _.each(value, function(rev){
                            html.push(rev.data.User._refObjectName);
                        });
                        return html.join('</br></br>');
                    }
                },
                {
                    text: 'Revision # and description',dataIndex: 'revisions', flex:1,
                    renderer:function(value){
                        var html = [];
                        _.each(value, function(rev){
                            html.push(rev.data.RevisionNumber + " " + rev.data.Description);
                        });
                        return html.join('</br></br>');
                    }
                }
            ]
        });
        
    }
    
});

